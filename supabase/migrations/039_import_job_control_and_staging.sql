-- 전체DB import 중복 실행 방지 / job 취소 / staging / 진행 상태
-- 주의: DROP, TRUNCATE, 전체 DELETE 없음. 기존 파트너·담당자·교육·문서 데이터 유지.

-- 1) import_jobs 확장
alter table public.import_jobs
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists processed_rows int not null default 0,
  add column if not exists idempotency_key text,
  add column if not exists file_hash text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

comment on column public.import_jobs.idempotency_key is
  'import_type + file_hash 기반 중복 방지 키';
comment on column public.import_jobs.processed_rows is
  '진행 중 처리된 행 수 (UI 표시용)';
comment on column public.import_jobs.cancelled_at is
  '취소 시각. status=cancelled 와 함께 사용';

create index if not exists import_jobs_status_updated_idx
  on public.import_jobs (status, updated_at desc);

create index if not exists import_jobs_idempotency_idx
  on public.import_jobs (idempotency_key, created_at desc)
  where idempotency_key is not null;

-- 동일 키로 processing/completed 동시 존재 방지 (재처리는 force 시 새 키 또는 completed 후 관리자 재실행)
create unique index if not exists import_jobs_active_idempotency_uidx
  on public.import_jobs (idempotency_key)
  where idempotency_key is not null
    and status in ('pending', 'processing');

-- updated_at 자동 갱신
create or replace function public.touch_import_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_import_jobs_touch_updated_at on public.import_jobs;
create trigger trg_import_jobs_touch_updated_at
before update on public.import_jobs
for each row
execute function public.touch_import_jobs_updated_at();

-- 2) contact import staging (적용 전 결과 보관 — 실패 시 baseline 미전환)
create table if not exists public.contact_import_staging (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number int not null,
  partner_id uuid,
  existing_contact_id uuid,
  action text not null,
  validation_status text not null default 'ok',
  person_key text,
  payload jsonb not null default '{}'::jsonb,
  email text,
  phone text,
  role_labels jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (import_job_id, row_number)
);

create index if not exists contact_import_staging_job_idx
  on public.contact_import_staging (import_job_id);

create index if not exists contact_import_staging_person_idx
  on public.contact_import_staging (import_job_id, person_key);

alter table public.contact_import_staging enable row level security;

drop policy if exists "authenticated read contact_import_staging" on public.contact_import_staging;
create policy "authenticated read contact_import_staging"
on public.contact_import_staging for select
to authenticated
using (true);

drop policy if exists "admins manage contact_import_staging" on public.contact_import_staging;
create policy "admins manage contact_import_staging"
on public.contact_import_staging for all
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

-- 3) 정규화 이름 컬럼 (조회/중복 방지용 — unique는 기존 중복이 있으면 실패하므로 비유니크 인덱스만)
alter table public.partner_contacts
  add column if not exists name_normalized text;

update public.partner_contacts
set name_normalized = lower(regexp_replace(coalesce(name, ''), '\s+', '', 'g'))
where name_normalized is null
  and name is not null;

create index if not exists partner_contacts_partner_name_norm_idx
  on public.partner_contacts (partner_id, name_normalized)
  where deleted_at is null
    and merged_into_contact_id is null;

-- 중복 후보 조회용 뷰 (정리 참고용 — 데이터 삭제하지 않음)
create or replace view public.contact_duplicate_candidates as
select
  partner_id,
  name_normalized,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as contact_ids
from public.partner_contacts
where deleted_at is null
  and merged_into_contact_id is null
  and name_normalized is not null
  and name_normalized <> ''
group by partner_id, name_normalized
having count(*) > 1;
