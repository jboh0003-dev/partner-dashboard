-- partner_documents 중복 관리 컬럼
alter table public.partner_documents
  add column if not exists is_active boolean default true,
  add column if not exists is_duplicate boolean default false,
  add column if not exists duplicate_of uuid references public.partner_documents(id),
  add column if not exists duplicate_reason text,
  add column if not exists representative boolean default false,
  add column if not exists upload_batch_id text,
  add column if not exists file_hash text,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

update public.partner_documents
set
  is_active = coalesce(is_active, true),
  is_duplicate = coalesce(is_duplicate, false),
  representative = coalesce(representative, is_primary)
where is_active is null
   or is_duplicate is null
   or representative is null;

-- 동일 파일명의 숨김 중복 row를 허용하기 위해 기존 unique index 제거
drop index if exists public.partner_documents_unique_file_idx;

-- 활성 대표 문서는 partner+type+filename 당 1건만 허용
create unique index if not exists partner_documents_active_unique_file_idx
  on public.partner_documents (partner_id, document_type, original_filename)
  where deleted_at is null
    and original_filename is not null
    and is_active = true
    and is_duplicate = false;

create index if not exists partner_documents_duplicate_idx
  on public.partner_documents (partner_id, document_type, is_duplicate, is_active);

create index if not exists partner_documents_duplicate_of_idx
  on public.partner_documents (duplicate_of);

notify pgrst, 'reload schema';
