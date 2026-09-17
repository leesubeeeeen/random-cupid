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
-- 2. 옵션 마스터 테이블 (매력 어필 포인트 / 이상형)
--    체크박스 문구를 나중에 추가/수정해도 참가자 데이터는 그대로 유지되도록 분리
-- ============================================================
create table if not exists public.appeal_point_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  gender_scope text not null default 'all' check (gender_scope in ('all', 'male', 'female')),
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ideal_type_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  gender_scope text not null default 'all' check (gender_scope in ('all', 'male', 'female')),
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.appeal_point_options is '나의 매력 어필 포인트 선택지 마스터';
comment on table public.ideal_type_options is '선호하는 이상형 선택지 마스터';
comment on column public.appeal_point_options.gender_scope is '이 옵션을 보여줄 대상 성별. all이면 남녀 모두에게 노출';

-- ============================================================
-- 3. 매핑 테이블 (참가자 <-> 선택한 옵션, N:M)
-- ============================================================
create table if not exists public.participant_appeal_points (
  participant_id uuid not null references public.participants(id) on delete cascade,
  appeal_point_option_id uuid not null references public.appeal_point_options(id),
  created_at timestamptz not null default now(),
  primary key (participant_id, appeal_point_option_id)
);

create table if not exists public.participant_ideal_types (
  participant_id uuid not null references public.participants(id) on delete cascade,
  ideal_type_option_id uuid not null references public.ideal_type_options(id),
  created_at timestamptz not null default now(),
  primary key (participant_id, ideal_type_option_id)
);

-- 매칭 로직에서 "이 옵션을 선택한 사람 목록" 조회가 빨라지도록 역방향 인덱스 추가
create index if not exists idx_participant_appeal_points_option
  on public.participant_appeal_points (appeal_point_option_id);

create index if not exists idx_participant_ideal_types_option
  on public.participant_ideal_types (ideal_type_option_id);

create index if not exists idx_participants_gender
  on public.participants (gender);

-- ============================================================
-- 4. 신청 1건을 원자적으로 저장하는 RPC 함수
--    participants + participant_appeal_points + participant_ideal_types
--    3개 테이블 쓰기를 하나의 트랜잭션으로 처리한다.
--    SECURITY DEFINER로 실행되어 RLS를 우회하므로, anon은 이 함수를 통해서만
--    데이터를 쓸 수 있고 테이블에 직접 접근할 수 없다.
-- ============================================================
create or replace function public.create_participant_application(
  p_gender text,
  p_name text,
  p_age int,
  p_major text,
  p_phone text,
  p_max_match_count smallint,
  p_appeal_point_ids uuid[],
  p_ideal_type_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid;
begin
  insert into public.participants (gender, name, age, major, phone, max_match_count)
  values (p_gender, trim(p_name), p_age, trim(p_major), p_phone, p_max_match_count)
  returning id into v_participant_id;

  if p_appeal_point_ids is not null and array_length(p_appeal_point_ids, 1) > 0 then
    insert into public.participant_appeal_points (participant_id, appeal_point_option_id)
    select v_participant_id, opt_id from unnest(p_appeal_point_ids) as opt_id;
  end if;

  if p_ideal_type_ids is not null and array_length(p_ideal_type_ids, 1) > 0 then
    insert into public.participant_ideal_types (participant_id, ideal_type_option_id)
    select v_participant_id, opt_id from unnest(p_ideal_type_ids) as opt_id;
  end if;

  return v_participant_id;
end;
$$;

-- ============================================================
-- 5. RLS 활성화
-- ============================================================
alter table public.participants enable row level security;
alter table public.participant_appeal_points enable row level security;
alter table public.participant_ideal_types enable row level security;
alter table public.appeal_point_options enable row level security;
alter table public.ideal_type_options enable row level security;

-- participants / participant_appeal_points / participant_ideal_types:
-- 정책을 하나도 만들지 않아 anon/authenticated는 direct SELECT/INSERT/UPDATE/DELETE가 전부 차단된다.
-- 쓰기는 오직 위 SECURITY DEFINER 함수를 통해서만 가능하다.

-- 옵션 테이블: 활성화된(is_active) 항목만 공개 조회 가능 (폼 렌더링용)
drop policy if exists "public read active appeal point options" on public.appeal_point_options;
create policy "public read active appeal point options"
  on public.appeal_point_options for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "public read active ideal type options" on public.ideal_type_options;
create policy "public read active ideal type options"
  on public.ideal_type_options for select
  to anon, authenticated
  using (is_active = true);

-- ============================================================
-- 6. 권한(GRANT) 명시적 정리 — RLS와 별개로 테이블 권한 자체를 최소화 (defense in depth)
-- ============================================================
revoke all on public.participants from anon, authenticated;
revoke all on public.participant_appeal_points from anon, authenticated;
revoke all on public.participant_ideal_types from anon, authenticated;

revoke all on public.appeal_point_options from anon, authenticated;
grant select on public.appeal_point_options to anon, authenticated;

revoke all on public.ideal_type_options from anon, authenticated;
grant select on public.ideal_type_options to anon, authenticated;

revoke all on function public.create_participant_application from public;
grant execute on function public.create_participant_application to anon, authenticated;

-- ============================================================
-- 7. 시드 데이터 (초기 옵션 3개씩) — 필요시 Supabase Studio 테이블 편집기에서 추가/수정 가능
-- ============================================================
insert into public.appeal_point_options (label, display_order)
values
  ('유머러스하고 대화가 잘 통해요', 1),
  ('다정하고 배려심이 많아요', 2),
  ('적극적이고 리더십이 있어요', 3)
on conflict (label) do nothing;

insert into public.ideal_type_options (label, display_order)
values
  ('유머러스한 사람이 좋아요', 1),
  ('다정하고 배려심 많은 사람이 좋아요', 2),
  ('취미나 관심사가 잘 맞는 사람이 좋아요', 3)
on conflict (label) do nothing;
