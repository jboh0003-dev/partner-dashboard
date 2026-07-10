-- 소클: grade_change_raw(플래티넘 원문)가 grade/service_partner 보정을 덮어쓰는 문제 수정

alter table public.partners
  add column if not exists grade_override text;

update public.partners
set
  grade_override = 'service_partner',
  grade = 'service_partner',
  grade_change_raw = '서비스파트너',
  grade_raw = '서비스파트너',
  updated_at = now()
where deleted_at is null
  and trim(company_name) = '소클';

notify pgrst, 'reload schema';
