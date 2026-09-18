-- 마이그레이션: "이상형" 옵션을 (1) 반대 성별 appeal_point_options 자동 연결 + (2) ideal_type_options에
-- 직접 추가하는 이상형 전용 옵션, 두 소스를 함께 쓸 수 있도록 스키마를 확장합니다.
-- 이미 최초 schema.sql을 적용한 기존 Supabase 프로젝트에서 SQL Editor로 1회 실행하세요.
-- (신규 프로젝트라면 이 파일 대신 supabase/schema.sql만 실행하면 됩니다 — 이미 반영되어 있습니다)
--
-- 기존 데이터(participants, participant_ideal_types 등)는 삭제하지 않습니다.
-- 여러 번 실행해도 안전하도록 작성했습니다.

-- 1) 라벨 유니크 제약을 (label, gender_scope)로 넓힘 — 같은 문구를 남/여 각각 등록할 수 있어야 함
alter table public.appeal_point_options
  drop constraint if exists appeal_point_options_label_key;
alter table public.appeal_point_options
  drop constraint if exists appeal_point_options_label_gender_scope_unique;
alter table public.appeal_point_options
  add constraint appeal_point_options_label_gender_scope_unique
  unique (label, gender_scope);

alter table public.ideal_type_options
  drop constraint if exists ideal_type_options_label_key;
alter table public.ideal_type_options
  drop constraint if exists ideal_type_options_label_gender_scope_unique;
alter table public.ideal_type_options
  add constraint ideal_type_options_label_gender_scope_unique
  unique (label, gender_scope);

-- 2) participant_ideal_types가 두 소스(appeal_point_options 또는 ideal_type_options) 중
--    정확히 하나를 가리킬 수 있도록 재구성. 기존 ideal_type_option_id 값은 그대로 유지됩니다.
alter table public.participant_ideal_types
  drop constraint if exists participant_ideal_types_pkey;

alter table public.participant_ideal_types
  alter column ideal_type_option_id drop not null;

alter table public.participant_ideal_types
  add column if not exists id uuid default gen_random_uuid();

update public.participant_ideal_types set id = gen_random_uuid() where id is null;

alter table public.participant_ideal_types
  alter column id set not null;

alter table public.participant_ideal_types
  add constraint participant_ideal_types_pkey primary key (id);

alter table public.participant_ideal_types
  add column if not exists appeal_point_option_id uuid references public.appeal_point_options(id);

alter table public.participant_ideal_types
  drop constraint if exists participant_ideal_types_exactly_one_source;
alter table public.participant_ideal_types
  add constraint participant_ideal_types_exactly_one_source check (
    (appeal_point_option_id is not null and ideal_type_option_id is null)
    or
    (appeal_point_option_id is null and ideal_type_option_id is not null)
  );

create unique index if not exists participant_ideal_types_appeal_unique
  on public.participant_ideal_types (participant_id, appeal_point_option_id)
  where appeal_point_option_id is not null;

create unique index if not exists participant_ideal_types_ideal_unique
  on public.participant_ideal_types (participant_id, ideal_type_option_id)
  where ideal_type_option_id is not null;

create index if not exists idx_participant_ideal_types_appeal_option
  on public.participant_ideal_types (appeal_point_option_id);

-- 3) RPC 함수 교체 — 인자가 8개(p_ideal_type_ids)에서 9개(p_ideal_type_appeal_ids, p_ideal_type_custom_ids)로
--    바뀌었으므로, create or replace가 아니라 기존 시그니처를 명시적으로 지운 뒤 새로 만듭니다.
drop function if exists public.create_participant_application(
  text, text, int, text, text, smallint, uuid[], uuid[]
);

create or replace function public.create_participant_application(
  p_gender text,
  p_name text,
  p_age int,
  p_major text,
  p_phone text,
  p_max_match_count smallint,
  p_appeal_point_ids uuid[],
  p_ideal_type_appeal_ids uuid[],
  p_ideal_type_custom_ids uuid[]
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

  if p_ideal_type_appeal_ids is not null and array_length(p_ideal_type_appeal_ids, 1) > 0 then
    insert into public.participant_ideal_types (participant_id, appeal_point_option_id)
    select v_participant_id, opt_id from unnest(p_ideal_type_appeal_ids) as opt_id;
  end if;

  if p_ideal_type_custom_ids is not null and array_length(p_ideal_type_custom_ids, 1) > 0 then
    insert into public.participant_ideal_types (participant_id, ideal_type_option_id)
    select v_participant_id, opt_id from unnest(p_ideal_type_custom_ids) as opt_id;
  end if;

  return v_participant_id;
end;
$$;

revoke all on function public.create_participant_application from public;
grant execute on function public.create_participant_application to anon, authenticated;
