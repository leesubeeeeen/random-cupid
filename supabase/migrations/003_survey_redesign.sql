-- 마이그레이션: "매력 어필 포인트 / 이상형" 2개 체크박스 그룹을,
-- 5지선다 질문 8개(외형 4 + 성격·매력 4) x 2페이지(본인소개 단일선택 / 이상형 복수선택 + 필수조건)
-- 구조로 전면 교체합니다.
--
-- 주의: appeal_point_options / ideal_type_options / participant_appeal_points /
-- participant_ideal_types 테이블을 삭제합니다. 이 테이블들에 이미 쌓인 신청 데이터가 있다면
-- 이 마이그레이션 실행 전에 반드시 백업하세요 (예: participant_applications_readable 뷰를 CSV로 내보내기).
-- 신규 프로젝트라면 이 파일 대신 supabase/schema.sql(최신본)만 실행하면 됩니다.
--
-- Supabase SQL Editor에서 1회 실행하세요.

-- ============================================================
-- 1. 기존 구조 제거
-- ============================================================
drop view if exists public.participant_applications_readable;
drop table if exists public.participant_ideal_types;
drop table if exists public.participant_appeal_points;
drop table if exists public.ideal_type_options;
drop table if exists public.appeal_point_options;

-- ============================================================
-- 2. 설문 질문 / 선택지 마스터 테이블
-- ============================================================
create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category text not null check (category in ('appearance', 'personality')),
  self_label text not null,
  ideal_label text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.survey_questions is '설문 질문 마스터 (본인소개 페이지 self_label / 이상형 페이지 ideal_label)';
comment on column public.survey_questions.category is '외형(appearance) / 성격·매력(personality) 섹션 구분';

create table if not exists public.survey_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  label text not null,
  gender_scope text not null default 'all' check (gender_scope in ('all', 'male', 'female')),
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint survey_options_question_scope_display_order_unique unique (question_id, gender_scope, display_order)
);

comment on column public.survey_options.gender_scope is '이 선택지를 보여줄 성별. all이면 성별 무관. 본인소개 페이지에서는 본인 성별 기준, 이상형 페이지에서는 반대 성별 기준으로 필터링됨 (예: 키 질문)';

-- ============================================================
-- 3. 참가자 답변 테이블
--    - 본인소개: 질문당 1개만 선택 (participant_id, question_id) unique
--    - 이상형: 질문당 여러 개 선택 가능 + is_must_match로 "필수 반영" 표시(참가자당 최대 2개, 앱에서 검증)
-- ============================================================
create table if not exists public.participant_self_answers (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id),
  option_id uuid not null references public.survey_options(id),
  created_at timestamptz not null default now(),
  constraint participant_self_answers_unique unique (participant_id, question_id)
);

create table if not exists public.participant_ideal_answers (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id),
  option_id uuid not null references public.survey_options(id),
  is_must_match boolean not null default false,
  created_at timestamptz not null default now(),
  constraint participant_ideal_answers_unique unique (participant_id, question_id, option_id)
);

create index if not exists idx_survey_options_question on public.survey_options (question_id);
create index if not exists idx_participant_self_answers_option on public.participant_self_answers (option_id);
create index if not exists idx_participant_ideal_answers_option on public.participant_ideal_answers (option_id);
create index if not exists idx_participant_ideal_answers_must_match
  on public.participant_ideal_answers (participant_id)
  where is_must_match = true;

-- ============================================================
-- 4. 신청 1건을 원자적으로 저장하는 RPC 함수
--    인자 개수/타입은 기존과 같지만(text,text,int,text,text,smallint,uuid[],uuid[],uuid[])
--    파라미터 이름이 바뀌어서 create or replace로는 교체가 안 된다(Postgres 제약) — 먼저 drop.
--    "필수 반영" 조건은 참가자당 최대 2개까지만 허용하고, 이상형으로 선택하지 않은 질문은
--    필수 조건으로 지정할 수 없도록 서버(DB)에서도 한 번 더 검증한다.
-- ============================================================
drop function if exists public.create_participant_application(
  text, text, int, text, text, smallint, uuid[], uuid[], uuid[]
);

create or replace function public.create_participant_application(
  p_gender text,
  p_name text,
  p_age int,
  p_major text,
  p_phone text,
  p_max_match_count smallint,
  p_self_option_ids uuid[],
  p_ideal_option_ids uuid[],
  p_must_match_question_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
begin
  if p_must_match_question_ids is not null and array_length(p_must_match_question_ids, 1) > 2 then
    raise exception 'must_match_question_ids exceeds limit of 2';
  end if;

  insert into public.participants (gender, name, age, major, phone, max_match_count)
  values (p_gender, trim(p_name), p_age, trim(p_major), p_phone, p_max_match_count)
  returning id into v_participant_id;

  if p_self_option_ids is not null and array_length(p_self_option_ids, 1) > 0 then
    insert into public.participant_self_answers (participant_id, question_id, option_id)
    select v_participant_id, so.question_id, so.id
    from public.survey_options so
    where so.id = any(p_self_option_ids);
  end if;

  if p_ideal_option_ids is not null and array_length(p_ideal_option_ids, 1) > 0 then
    insert into public.participant_ideal_answers (participant_id, question_id, option_id)
    select v_participant_id, so.question_id, so.id
    from public.survey_options so
    where so.id = any(p_ideal_option_ids);
  end if;

  if p_must_match_question_ids is not null and array_length(p_must_match_question_ids, 1) > 0 then
    if exists (
      select 1
      from unnest(p_must_match_question_ids) as qid
      where not exists (
        select 1 from public.participant_ideal_answers pia
        where pia.participant_id = v_participant_id and pia.question_id = qid
      )
    ) then
      raise exception 'must_match_question_ids must reference a question with a selected ideal answer';
    end if;

    update public.participant_ideal_answers
    set is_must_match = true
    where participant_id = v_participant_id
      and question_id = any(p_must_match_question_ids);
  end if;

  return v_participant_id;
end;
$$;

revoke all on function public.create_participant_application from public;
grant execute on function public.create_participant_application to anon, authenticated;

-- ============================================================
-- 5. RLS
-- ============================================================
alter table public.survey_questions enable row level security;
alter table public.survey_options enable row level security;
alter table public.participant_self_answers enable row level security;
alter table public.participant_ideal_answers enable row level security;

-- participant_self_answers / participant_ideal_answers: 정책 없음 -> anon/authenticated 직접 접근 전부 차단.
-- 쓰기는 오직 SECURITY DEFINER 함수를 통해서만 가능하다.

drop policy if exists "public read active survey questions" on public.survey_questions;
create policy "public read active survey questions"
  on public.survey_questions for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "public read options of active questions" on public.survey_options;
create policy "public read options of active questions"
  on public.survey_options for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.survey_questions q
      where q.id = survey_options.question_id and q.is_active = true
    )
  );

revoke all on public.survey_questions from anon, authenticated;
grant select on public.survey_questions to anon, authenticated;

revoke all on public.survey_options from anon, authenticated;
grant select on public.survey_options to anon, authenticated;

revoke all on public.participant_self_answers from anon, authenticated;
revoke all on public.participant_ideal_answers from anon, authenticated;

-- ============================================================
-- 6. 시드 데이터 — 질문 8개(외형 4 + 성격·매력 4) x 선택지 5개
--    문구는 Supabase Studio 테이블 편집기에서 언제든 추가/수정 가능
-- ============================================================
insert into public.survey_questions (key, category, self_label, ideal_label, display_order) values
  ('face_type', 'appearance', '본인 얼굴은?', '본인이 원하는 상대방의 얼굴상은?', 1),
  ('height', 'appearance', '본인 키는?', '본인이 원하는 상대방의 키는?', 2),
  ('body_type', 'appearance', '본인 체형은?', '본인이 원하는 상대방의 체형은?', 3),
  ('fashion_style', 'appearance', '본인 패션 스타일은?', '본인이 원하는 상대방의 패션 스타일은?', 4),
  ('personality', 'personality', '본인 성격은?', '본인이 원하는 상대방의 성격은?', 5),
  ('appeal_point', 'personality', '본인 매력 포인트는?', '본인이 원하는 상대방의 매력 포인트는?', 6),
  ('hobby', 'personality', '본인 취미·관심사는?', '본인이 원하는 상대방의 취미·관심사는?', 7),
  ('romance_style', 'personality', '본인 연애 스타일은?', '본인이 원하는 상대방의 연애 스타일은?', 8)
on conflict (key) do nothing;

insert into public.survey_options (question_id, gender_scope, label, display_order)
select q.id, v.gender_scope, v.label, v.display_order
from (values
  ('face_type', 'all', '강아지상', 1),
  ('face_type', 'all', '고양이상', 2),
  ('face_type', 'all', '토끼상', 3),
  ('face_type', 'all', '여우상', 4),
  ('face_type', 'all', '늑대상', 5),
  ('face_type', 'all', '두부상', 6),
  ('face_type', 'all', '원숭이상', 7),
  ('face_type', 'all', '공룡상', 8),

  -- 키: 성별마다 체감 구간이 달라 gender_scope로 분리.
  -- 본인소개에서는 본인 성별 옵션이, 이상형에서는 반대 성별 옵션이 노출된다.
  ('height', 'female', '160cm 미만', 1),
  ('height', 'female', '160~165cm', 2),
  ('height', 'female', '165~170cm', 3),
  ('height', 'female', '170~175cm', 4),
  ('height', 'female', '175cm 이상', 5),

  ('height', 'male', '165cm 미만', 1),
  ('height', 'male', '165~170cm', 2),
  ('height', 'male', '170~175cm', 3),
  ('height', 'male', '175~180cm', 4),
  ('height', 'male', '180cm 이상', 5),

  ('body_type', 'all', '말랐어요', 1),
  ('body_type', 'all', '슬림해요', 2),
  ('body_type', 'all', '보통이에요', 3),
  ('body_type', 'all', '탄탄해요', 4),
  ('body_type', 'all', '통통해요', 5),

  ('fashion_style', 'all', '캐주얼', 1),
  ('fashion_style', 'all', '미니멀', 2),
  ('fashion_style', 'all', '스트릿', 3),
  ('fashion_style', 'all', '클래식', 4),
  ('fashion_style', 'all', '개성있는 스타일', 5),

  ('personality', 'all', '재밌는 성격', 1),
  ('personality', 'all', '다정한 성격', 2),
  ('personality', 'all', '센스있는 성격', 3),
  ('personality', 'all', '조용한 성격', 4),
  ('personality', 'all', '적극적인 성격', 5),
  ('personality', 'all', '귀여운 성격', 6),

  ('appeal_point', 'all', '옷을 잘 입어요', 1),
  ('appeal_point', 'all', '웃는 게 예뻐요', 2),
  ('appeal_point', 'all', '공부를 잘해요', 3),
  ('appeal_point', 'all', '웃겨요', 4),
  ('appeal_point', 'all', '데이트 코스를 잘 짜요', 5),
  ('appeal_point', 'all', '요리를 잘해요', 6),
  ('appeal_point', 'all', '운동을 잘해요', 7),
  ('appeal_point', 'all', '노래를 잘해요', 8),
  ('appeal_point', 'all', '춤을 잘춰요', 9),

  ('hobby', 'all', '운동', 1),
  ('hobby', 'all', '게임', 2),
  ('hobby', 'all', '여행', 3),
  ('hobby', 'all', '카페·맛집 투어', 4),
  ('hobby', 'all', '독서·전시 관람', 5),
  ('hobby', 'all', '요리', 6),
  ('hobby', 'all', '음악(연주, 듣기, 작곡 등)', 7),
  ('hobby', 'all', '공예', 8),
  ('hobby', 'all', '기타', 9),

  ('romance_style', 'all', '애정표현이 많아요', 1),
  ('romance_style', 'all', '츤데레예요', 2),
  ('romance_style', 'all', '배려심 많고 다정해요', 3),
  ('romance_style', 'all', '친구같은 연애를 좋아해요', 4),
  ('romance_style', 'all', '적극적으로 리드해요', 5),

) as v(question_key, gender_scope, label, display_order)
join public.survey_questions q on q.key = v.question_key
on conflict (question_id, gender_scope, display_order) do nothing;

-- ============================================================
-- 7. 조회용 뷰 — 관리자 전용 (anon/authenticated 접근 불가)
-- ============================================================
create or replace view public.participant_applications_readable as
select
  p.id,
  p.created_at,
  p.gender,
  p.name,
  p.age,
  p.major,
  p.phone,
  p.max_match_count,
  (
    select string_agg(sq.self_label || ': ' || so.label, ' / ' order by sq.display_order)
    from public.participant_self_answers psa
    join public.survey_questions sq on sq.id = psa.question_id
    join public.survey_options so on so.id = psa.option_id
    where psa.participant_id = p.id
  ) as self_answers,
  (
    select string_agg(
      sq.ideal_label || ': ' || so.label || case when pia.is_must_match then ' (필수)' else '' end,
      ' / ' order by sq.display_order, so.display_order
    )
    from public.participant_ideal_answers pia
    join public.survey_questions sq on sq.id = pia.question_id
    join public.survey_options so on so.id = pia.option_id
    where pia.participant_id = p.id
  ) as ideal_answers
from public.participants p
order by p.created_at desc;

revoke all on public.participant_applications_readable from anon, authenticated;
