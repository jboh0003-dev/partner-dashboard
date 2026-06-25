-- partner_documents 확장 + Storage bucket
alter table public.partner_documents
  add column if not exists partner_name_raw text,
  add column if not exists document_status text default 'active',
  add column if not exists original_filename text,
  add column if not exists display_name text,
  add column if not exists storage_path text,
  add column if not exists file_ext text,
  add column if not exists file_size bigint,
  add column if not exists source_folder text,
  add column if not exists source_file text,
  add column if not exists received_date date,
  add column if not exists contract_date date,
  add column if not exists partner_no text,
  add column if not exists grade_from_file text,
  add column if not exists period_year int,
  add column if not exists period_quarter text,
  add column if not exists period_month int,
  add column if not exists is_primary boolean default false,
  add column if not exists priority_score int default 0,
  add column if not exists note text,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz;

-- uploaded_by: text 저장 (업로드 포털 사용자명 등)
alter table public.partner_documents drop constraint if exists partner_documents_uploaded_by_fkey;
alter table public.partner_documents
  alter column uploaded_by type text using uploaded_by::text;

update public.partner_documents
set
  original_filename = coalesce(original_filename, file_name),
  display_name = coalesce(display_name, file_name),
  storage_path = coalesce(storage_path, file_path),
  document_status = coalesce(document_status, 'active')
where original_filename is null
   or display_name is null
   or storage_path is null
   or document_status is null;

create index if not exists partner_documents_partner_type_idx
  on public.partner_documents (partner_id, document_type);

create index if not exists partner_documents_primary_idx
  on public.partner_documents (partner_id, document_type, is_primary);

create index if not exists partner_documents_deleted_idx
  on public.partner_documents (deleted_at);

create unique index if not exists partner_documents_unique_file_idx
  on public.partner_documents (partner_id, document_type, original_filename)
  where deleted_at is null and original_filename is not null;

drop trigger if exists set_partner_documents_updated_at on public.partner_documents;
create trigger set_partner_documents_updated_at
before update on public.partner_documents
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('partner-documents', 'partner-documents', false)
on conflict (id) do nothing;
