-- 랜덤소개팅 신청 웹사이트 - Supabase 스키마
-- Supabase 프로젝트 생성 후 SQL Editor에 이 파일 전체를 붙여넣어 1회 실행하세요.
-- 여러 번 실행해도 안전하도록 IF NOT EXISTS / OR REPLACE / ON CONFLICT를 사용합니다.

create extension if not exists pgcrypto;

-- ============================================================
-- 1. 참가자 본체
-- ============================================================
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  gender text not null check (gender in ('male', 'female')),
  name text not null check (char_length(trim(name)) > 0),
  age int not null check (age between 18 and 100), -- 한국식 나이 기준
  major text not null check (char_length(trim(major)) > 0),
  phone text not null check (phone ~ '^01[016789][0-9]{7,8}$'), -- 숫자만 정규화해서 저장
  max_match_count smallint not null check (max_match_count in (1, 2)),
  created_at timestamptz not null default now(),
  constraint participants_phone_unique unique (phone)
);

comment on table public.participants is '랜덤소개팅 참가 신청자 (AI 매칭 로직의 입력 데이터)';
comment on column public.participants.age is '한국식 나이';
comment on column public.participants.phone is '숫자만 저장 (예: 01012345678)';
comment on column public.participants.max_match_count is '희망 매칭 인원: 1 또는 2';

-- ============================================================
-- 2. 설문 질문 / 선택지 마스터 테이블
--    5지선다 질문 여러 개로 구성된 2페이지 설문(본인소개/이상형)을 위한 구조.
--    질문 문구를 나중에 추가/수정해도 참가자 데이터는 그대로 유지되도록 분리.
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

create table if not exists public.survey_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  label text not null,
  gender_scope text not null default 'all' check (gender_scope in ('all', 'male', 'female')),
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint survey_options_question_scope_display_order_unique unique (question_id, gender_scope, display_order)
);

comment on table public.survey_questions is '설문 질문 마스터. self_label은 1페이지(본인소개, 단일선택), ideal_label은 2페이지(이상형, 복수선택)에 노출';
comment on column public.survey_questions.category is '외형(appearance) / 성격·매력(personality) 섹션 구분';
comment on column public.survey_options.gender_scope is '이 선택지를 보여줄 성별. all이면 성별 무관. 본인소개 페이지에서는 본인 성별 기준, 이상형 페이지에서는 반대 성별 기준으로 필터링됨 (예: 키 질문)';

-- ============================================================
-- 3. 참가자 답변 테이블
--    - 본인소개: 질문당 1개만 선택 (participant_id, question_id) unique
--    - 이상형: 질문당 여러 개 선택 가능 + is_must_match로 "이 조건은 꼭 반영해주세요" 표시
--      (참가자당 최대 2개까지만 허용 — 애플리케이션/RPC에서 검증)
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

-- 매칭 로직에서 "이 옵션을 선택한 사람 목록" 조회가 빨라지도록 역방향 인덱스 추가
create index if not exists idx_survey_options_question
  on public.survey_options (question_id);

create index if not exists idx_participant_self_answers_option
  on public.participant_self_answers (option_id);

create index if not exists idx_participant_ideal_answers_option
  on public.participant_ideal_answers (option_id);

create index if not exists idx_participant_ideal_answers_must_match
  on public.participant_ideal_answers (participant_id)
  where is_must_match = true;

create index if not exists idx_participants_gender
  on public.participants (gender);

-- ============================================================
-- 4. 신청 1건을 원자적으로 저장하는 RPC 함수
--    participants + participant_self_answers + participant_ideal_answers
--    3개 테이블 쓰기를 하나의 트랜잭션으로 처리한다.
--    SECURITY DEFINER로 실행되어 RLS를 우회하므로, anon은 이 함수를 통해서만
--    데이터를 쓸 수 있고 테이블에 직접 접근할 수 없다.
--    (예전 버전의 schema.sql을 이미 실행한 적이 있는 프로젝트라면 파라미터 이름이 달라
--    create or replace가 실패할 수 있어 먼저 drop한다 — Postgres는 파라미터 이름 변경을 허용하지 않음)
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

-- ============================================================
-- 5. RLS 활성화
-- ============================================================
alter table public.participants enable row level security;
alter table public.participant_self_answers enable row level security;
alter table public.participant_ideal_answers enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_options enable row level security;

-- participants / participant_self_answers / participant_ideal_answers:
-- 정책을 하나도 만들지 않아 anon/authenticated는 direct SELECT/INSERT/UPDATE/DELETE가 전부 차단된다.
-- 쓰기는 오직 위 SECURITY DEFINER 함수를 통해서만 가능하다.

-- 설문 테이블: 활성화된(is_active) 항목만 공개 조회 가능 (폼 렌더링용)
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

-- ============================================================
-- 6. 권한(GRANT) 명시적 정리 — RLS와 별개로 테이블 권한 자체를 최소화 (defense in depth)
-- ============================================================
revoke all on public.participants from anon, authenticated;
revoke all on public.participant_self_answers from anon, authenticated;
revoke all on public.participant_ideal_answers from anon, authenticated;

revoke all on public.survey_questions from anon, authenticated;
grant select on public.survey_questions to anon, authenticated;

revoke all on public.survey_options from anon, authenticated;
grant select on public.survey_options to anon, authenticated;

revoke all on function public.create_participant_application from public;
grant execute on function public.create_participant_application to anon, authenticated;

-- ============================================================
-- 7. 시드 데이터 — 질문 8개(외형 4 + 성격·매력 4), 선택지는 기본 5개씩 시작
--    선택지 개수는 질문마다 자유롭게 늘려도 된다 (코드/제약 모두 5개로 고정돼 있지 않음).
--    Supabase Studio 테이블 편집기 또는 SQL로 survey_options에 행을 추가하면 되고,
--    같은 question_id 안에서 display_order만 겹치지 않게 주면 된다.
--    (예: appeal_point, hobby, romance_style에 옵션을 더 추가하고 싶을 때)
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

  ('fashion_style', 'all', '캐주얼 스타일', 1),
  ('fashion_style', 'all', '미니멀 스타일', 2),
  ('fashion_style', 'all', '스트릿 스타일', 3),
  ('fashion_style', 'all', '단정한 클래식 스타일', 4),
  ('fashion_style', 'all', '개성있는 스타일', 5),

  ('personality', 'all', '재밌는 성격', 1),
  ('personality', 'all', '다정한 성격', 2),
  ('personality', 'all', '센스있는 성격', 3),
  ('personality', 'all', '조용한 성격', 4),
  ('personality', 'all', '적극적인 성격', 5),

  ('appeal_point', 'all', '옷을 잘 입어요', 1),
  ('appeal_point', 'all', '웃는 게 예뻐요', 2),
  ('appeal_point', 'all', '공부를 잘해요', 3),
  ('appeal_point', 'all', '해피바이러스예요', 4),
  ('appeal_point', 'all', '데이트 코스를 잘 짜요', 5),

  ('hobby', 'all', '운동', 1),
  ('hobby', 'all', '게임', 2),
  ('hobby', 'all', '여행', 3),
  ('hobby', 'all', '카페·맛집 투어', 4),
  ('hobby', 'all', '독서·전시 관람', 5),

  ('romance_style', 'all', '애정표현이 많아요', 1),
  ('romance_style', 'all', '츤데레예요', 2),
  ('romance_style', 'all', '배려심 많고 다정해요', 3),
  ('romance_style', 'all', '쿨한 연애를 해요', 4),
  ('romance_style', 'all', '적극적으로 리드해요', 5)
) as v(question_key, gender_scope, label, display_order)
join public.survey_questions q on q.key = v.question_key
on conflict (question_id, gender_scope, display_order) do nothing;

-- ============================================================
-- 8. 조회용 뷰 — UUID 대신 실제 선택 문구를 바로 볼 수 있도록 라벨까지 조인해서 펼쳐준다.
--    Supabase Studio의 SQL Editor / Table Editor(Views)에서 조회·CSV 내보내기용으로 사용.
--    anon/authenticated에게는 권한을 주지 않아 대시보드(관리자)에서만 조회 가능하다.
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
