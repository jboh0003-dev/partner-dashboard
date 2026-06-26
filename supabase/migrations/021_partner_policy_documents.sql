create table if not exists public.partner_policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_title text not null,
  version_label text not null,
  effective_date date not null,
  source_file_name text not null,
  storage_path text not null,
  file_type text not null,
  file_size bigint,
  description text,
  change_memo text,
  is_current boolean not null default false,
  status text not null default 'active',
  uploaded_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_policy_documents_current
  on public.partner_policy_documents (is_current, status);

create index if not exists idx_partner_policy_documents_effective_date
  on public.partner_policy_documents (effective_date desc);

create table if not exists public.partner_policy_chunks (
  id uuid primary key default gen_random_uuid(),
  policy_document_id uuid not null references public.partner_policy_documents(id) on delete cascade,
  section_title text,
  category text,
  slide_number int,
  page_number int,
  content text not null,
  keywords text[],
  raw_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_policy_chunks_document
  on public.partner_policy_chunks (policy_document_id);

create index if not exists idx_partner_policy_chunks_category
  on public.partner_policy_chunks (category);
