-- 교육 참석: 비파트너 교육생 보존 (partner_id nullable + 원본 회사명)
-- Production에는 실행하지 않음. 배포 전 Supabase에서 적용 필요.

alter table public.training_attendance
  alter column partner_id drop not null;

alter table public.training_attendance
  add column if not exists company_name_raw text;

drop index if exists public.training_attendance_tech_person_uidx;

create unique index if not exists training_attendance_tech_person_uidx
  on public.training_attendance (
    training_id,
    partner_id,
    lower(trim(attendee_name)),
    coalesce(regexp_replace(coalesce(attendee_phone, ''), '\D', '', 'g'), '')
  )
  where partner_id is not null;

create unique index if not exists training_attendance_non_partner_person_uidx
  on public.training_attendance (
    training_id,
    lower(trim(coalesce(company_name_raw, ''))),
    lower(trim(coalesce(attendee_name, '')))
  )
  where partner_id is null;

create index if not exists training_attendance_company_name_raw_idx
  on public.training_attendance (company_name_raw)
  where partner_id is null;
