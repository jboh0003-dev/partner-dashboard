alter table public.partners
  add column if not exists external_no text,
  add column if not exists okestro_owner text,
  add column if not exists contract_contact_name text,
  add column if not exists contract_contact_phone text,
  add column if not exists contract_contact_email text,
  add column if not exists revenue_2023 text,
  add column if not exists employee_count text,
  add column if not exists credit_rating text,
  add column if not exists region_group text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists source_file text,
  add column if not exists last_synced_at timestamptz;

alter table public.partner_contacts
  add column if not exists role_raw text,
  add column if not exists is_primary boolean not null default false,
  add column if not exists is_contract_contact boolean not null default false,
  add column if not exists source_file text,
  add column if not exists last_synced_at timestamptz;

alter table public.trainings
  add column if not exists training_year int,
  add column if not exists training_month int,
  add column if not exists source_file text;

alter table public.training_attendance
  add column if not exists attendee_department text,
  add column if not exists attendee_position text,
  add column if not exists attendee_phone text,
  add column if not exists attendee_email text,
  add column if not exists attendance_status text,
  add column if not exists raw_value text,
  add column if not exists source_file text;

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  file_name text not null,
  status text not null,
  total_rows int,
  created_count int,
  updated_count int,
  skipped_count int,
  review_count int,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.import_review_queue (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid references public.import_jobs(id) on delete cascade,
  import_type text not null,
  row_number int,
  company_name text,
  reason text not null,
  raw_data jsonb not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists import_jobs_type_idx
  on public.import_jobs (import_type, created_at desc);

create index if not exists import_review_queue_job_idx
  on public.import_review_queue (import_job_id);

create index if not exists import_review_queue_status_idx
  on public.import_review_queue (status, created_at desc);

alter table public.import_jobs enable row level security;
alter table public.import_review_queue enable row level security;

drop policy if exists "authenticated read import_jobs" on public.import_jobs;
create policy "authenticated read import_jobs"
on public.import_jobs for select
to authenticated
using (true);

drop policy if exists "admins manage import_jobs" on public.import_jobs;
create policy "admins manage import_jobs"
on public.import_jobs for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'user')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'user')
  )
);

drop policy if exists "authenticated read import_review_queue" on public.import_review_queue;
create policy "authenticated read import_review_queue"
on public.import_review_queue for select
to authenticated
using (true);

drop policy if exists "admins manage import_review_queue" on public.import_review_queue;
create policy "admins manage import_review_queue"
on public.import_review_queue for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'user')
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role in ('admin', 'user')
  )
);
