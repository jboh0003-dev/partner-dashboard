-- 수동 등급 지정(대시보드 수정) — 최종 표시 등급 1순위

alter table public.partners
  add column if not exists grade_override text;

-- 소클: Service Partner로 최종 등급 고정
update public.partners
set
  grade_override = 'service_partner',
  grade = 'service_partner',
  updated_at = now()
where deleted_at is null
  and trim(company_name) = '소클';

notify pgrst, 'reload schema';
