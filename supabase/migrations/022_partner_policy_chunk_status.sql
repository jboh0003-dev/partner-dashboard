alter table if exists public.partner_policy_chunks
  add column if not exists is_active boolean not null default true;

alter table if exists public.partner_policy_chunks
  add column if not exists parse_status text not null default 'active';

create index if not exists idx_partner_policy_chunks_active
  on public.partner_policy_chunks (policy_document_id, is_active);
