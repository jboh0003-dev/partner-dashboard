-- import 처리 이력 + 이메일 반송 상세 필드

create table if not exists public.import_logs (
  id uuid primary key default gen_random_uuid(),
  import_type text not null,
  original_filename text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  total_rows integer not null default 0,
  success_count integer not null default 0,
  failed_count integer not null default 0,
  review_count integer not null default 0,
  merge_count integer not null default 0,
  excluded_count integer not null default 0,
  storage_file_deleted boolean not null default false,
  storage_path text,
  status text not null default 'success',
  error_message text,
  import_job_id uuid references public.import_jobs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists import_logs_type_uploaded_idx
  on public.import_logs (import_type, uploaded_at desc);

comment on table public.import_logs is 'import용 엑셀 처리 이력 (원본 파일은 Storage에 영구 보관하지 않음)';

alter table public.contact_emails
  add column if not exists bounced_at timestamptz,
  add column if not exists bounce_reason text,
  add column if not exists last_bounce_source text,
  add column if not exists retry_needed boolean not null default false;

comment on column public.contact_emails.bounced_at is '마지막 반송 처리 시각';
comment on column public.contact_emails.bounce_reason is '반송/차단 사유 원문';
comment on column public.contact_emails.last_bounce_source is '반송 정보 출처 (import, manual, mail_provider 등)';
comment on column public.contact_emails.retry_needed is 'soft bounce 등 재시도 필요 여부';

-- temp-imports bucket (import용 엑셀 임시 저장, 처리 후 삭제)
insert into storage.buckets (id, name, public)
values ('temp-imports', 'temp-imports', false)
on conflict (id) do nothing;
