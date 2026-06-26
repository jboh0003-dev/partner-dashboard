-- 기술파트너 교육/시험 결과 확장 (기존 데이터 유지)
alter table public.trainings
  add column if not exists description text,
  add column if not exists exam_date date,
  add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.training_attendance
  add column if not exists contact_id uuid references public.partner_contacts(id) on delete set null,
  add column if not exists rank int,
  add column if not exists converted_score numeric,
  add column if not exists exam_status text,
  add column if not exists attendance_days int,
  add column if not exists partial_days int,
  add column if not exists absent_days int,
  add column if not exists attendance_rate numeric,
  add column if not exists group_name text,
  add column if not exists match_status text,
  add column if not exists review_reason text,
  add column if not exists extra_json jsonb default '{}'::jsonb;

create unique index if not exists training_attendance_tech_person_uidx
  on public.training_attendance (
    training_id,
    partner_id,
    lower(trim(attendee_name)),
    coalesce(regexp_replace(attendee_phone, '\D', '', 'g'), '')
  );
