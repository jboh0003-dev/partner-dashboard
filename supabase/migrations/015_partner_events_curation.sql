-- 행사 마스터·자료 큐레이션 스키마 확장 (014 기반)
alter table public.partner_events
  add column if not exists event_date_start date,
  add column if not exists event_date_end date,
  add column if not exists keywords text,
  add column if not exists visibility text default 'public';

update public.partner_events
set event_date_start = event_date
where event_date_start is null and event_date is not null;

alter table public.partner_event_documents
  add column if not exists file_extension text,
  add column if not exists file_size bigint,
  add column if not exists version_label text,
  add column if not exists is_representative boolean default false,
  add column if not exists is_active boolean default true,
  add column if not exists is_internal boolean default false,
  add column if not exists is_duplicate boolean default false,
  add column if not exists exclude_reason text,
  add column if not exists upload_status text,
  add column if not exists source_path text,
  add column if not exists visibility text default 'public';

create index if not exists partner_event_documents_public_idx
  on public.partner_event_documents (event_id, is_active, is_representative, is_internal);

create index if not exists partner_event_documents_upload_status_idx
  on public.partner_event_documents (upload_status);

create index if not exists partner_events_visibility_idx
  on public.partner_events (visibility);

-- 검수 전 로컬 스캔 메타 (Storage 미업로드·제외 파일 포함)
create table if not exists public.partner_event_curation_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.partner_events(id) on delete cascade,
  source_folder_name text not null,
  source_path text not null,
  original_filename text not null,
  file_extension text,
  file_size bigint,
  document_type text,
  upload_status text not null,
  exclude_reason text,
  display_name text,
  version_label text,
  is_representative boolean default false,
  upload_selected boolean default false,
  visibility text default 'public',
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_event_curation_folder_idx
  on public.partner_event_curation_items (source_folder_name);

alter table public.partner_event_curation_items enable row level security;

create policy "authenticated read partner_event_curation_items"
on public.partner_event_curation_items for select
to authenticated
using (true);

create policy "authenticated write partner_event_curation_items"
on public.partner_event_curation_items for all
to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
