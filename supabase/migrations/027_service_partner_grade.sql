-- 서비스파트너 등급: 소클 파트너 grade 보정 (원본 등급은 grade_original / grade_change_raw에 보존)

update public.partners
set
  grade_original = coalesce(grade_original, grade_raw, grade),
  grade_change_raw = coalesce(
    nullif(trim(grade_change_raw), ''),
    '서비스파트너'
  ),
  grade = 'service_partner',
  updated_at = now()
where deleted_at is null
  and trim(company_name) = '소클'
  and coalesce(grade, '') <> 'service_partner';

notify pgrst, 'reload schema';
