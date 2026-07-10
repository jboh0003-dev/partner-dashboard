-- 파트너 등급 원본/변경 컬럼 분리

alter table public.partners
  add column if not exists grade_original text,
  add column if not exists grade_change_raw text;

-- 기존 grade_raw를 등급 변경 원문으로 이관 (가능한 경우)
update public.partners
set grade_change_raw = grade_raw
where grade_change_raw is null
  and grade_raw is not null
  and trim(grade_raw) <> '';

notify pgrst, 'reload schema';
