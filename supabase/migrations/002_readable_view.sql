-- 마이그레이션: 신청 데이터를 UUID가 아니라 실제 선택 문구로 바로 볼 수 있는 조회용 뷰 추가.
-- Supabase SQL Editor에서 1회 실행하세요. 기존 데이터/테이블은 전혀 건드리지 않습니다 (읽기 전용 뷰 생성).
-- 001_cross_link_ideal_type.sql을 먼저 적용한 뒤에 실행해주세요
-- (participant_ideal_types의 appeal_point_option_id 컬럼을 사용합니다).

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
    select string_agg(apo.label, ', ' order by apo.display_order)
    from public.participant_appeal_points pap
    join public.appeal_point_options apo on apo.id = pap.appeal_point_option_id
    where pap.participant_id = p.id
  ) as appeal_points,
  (
    select string_agg(coalesce(apo2.label, ito.label), ', ' order by coalesce(apo2.display_order, ito.display_order))
    from public.participant_ideal_types pit
    left join public.appeal_point_options apo2 on apo2.id = pit.appeal_point_option_id
    left join public.ideal_type_options ito on ito.id = pit.ideal_type_option_id
    where pit.participant_id = p.id
  ) as ideal_types
from public.participants p
order by p.created_at desc;

-- 익명 사용자에게는 절대 노출하지 않음 (전화번호 등 개인정보 포함) — Studio 대시보드(관리자)에서만 조회
revoke all on public.participant_applications_readable from anon, authenticated;
