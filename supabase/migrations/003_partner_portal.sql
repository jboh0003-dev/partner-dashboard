-- 003_partner_portal.sql
-- 파트너 통합 정보 포털 확장 (PoC, 문서, AI 에이전트용 청크/검색로그)

-- 1. PoC 이력
create table if not exists public.partner_pocs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  poc_name text,
  customer_name text,
  product_name text,
  start_date date,
  end_date date,
  role_description text,
  result_status text,
  result_summary text,
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists partner_pocs_partner_idx
  on public.partner_pocs (partner_id);

create index if not exists partner_pocs_product_idx
  on public.partner_pocs (product_name);

create index if not exists partner_pocs_customer_idx
  on public.partner_pocs (customer_name);

-- 2. partner_documents 컬럼 확장 (기존 001 테이블)
alter table public.partner_documents
  add column if not exists file_url text,
  add column if not exists summary text;

-- file_url 만 있는 경우를 허용 (file_path nullable)
alter table public.partner_documents
  alter column file_path drop not null;

create index if not exists partner_documents_partner_idx
  on public.partner_documents (partner_id);

create index if not exists partner_documents_type_idx
  on public.partner_documents (document_type);

-- 3. 문서 청크 (향후 AI RAG용)
create table if not exists public.partner_document_chunks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  document_id uuid not null references public.partner_documents(id) on delete cascade,
  chunk_text text not null,
  page_number int,
  source_label text,
  created_at timestamptz not null default now()
);

create index if not exists partner_document_chunks_partner_idx
  on public.partner_document_chunks (partner_id);

create index if not exists partner_document_chunks_document_idx
  on public.partner_document_chunks (document_id);

-- 4. 검색 로그 (향후 AI 에이전트용)
create table if not exists public.partner_search_logs (
  id uuid primary key default gen_random_uuid(),
  user_query text not null,
  matched_partner_id uuid references public.partners(id) on delete set null,
  intent text,
  answer text,
  created_at timestamptz not null default now()
);

create index if not exists partner_search_logs_partner_idx
  on public.partner_search_logs (matched_partner_id);

create index if not exists partner_search_logs_created_idx
  on public.partner_search_logs (created_at desc);

-- 5. RLS
alter table public.partner_pocs enable row level security;
alter table public.partner_document_chunks enable row level security;
alter table public.partner_search_logs enable row level security;

drop policy if exists "authenticated read partner_pocs" on public.partner_pocs;
create policy "authenticated read partner_pocs"
on public.partner_pocs for select
to authenticated
using (true);

drop policy if exists "admins manage partner_pocs" on public.partner_pocs;
create policy "admins manage partner_pocs"
on public.partner_pocs for all
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

drop policy if exists "authenticated read partner_document_chunks" on public.partner_document_chunks;
create policy "authenticated read partner_document_chunks"
on public.partner_document_chunks for select
to authenticated
using (true);

drop policy if exists "admins manage partner_document_chunks" on public.partner_document_chunks;
create policy "admins manage partner_document_chunks"
on public.partner_document_chunks for all
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

drop policy if exists "authenticated read partner_search_logs" on public.partner_search_logs;
create policy "authenticated read partner_search_logs"
on public.partner_search_logs for select
to authenticated
using (true);

drop policy if exists "admins manage partner_search_logs" on public.partner_search_logs;
create policy "admins manage partner_search_logs"
on public.partner_search_logs for all
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

-- partner_documents 관리 정책 (001 에 read 만 있었음)
drop policy if exists "admins manage partner_documents" on public.partner_documents;
create policy "admins manage partner_documents"
on public.partner_documents for all
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

-- partner_assets 관리 정책 (001 에 read 만 있었음)
drop policy if exists "admins manage partner_assets" on public.partner_assets;
create policy "admins manage partner_assets"
on public.partner_assets for all
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
