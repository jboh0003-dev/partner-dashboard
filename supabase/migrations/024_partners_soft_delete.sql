-- 파트너 soft delete (목록 숨김)

alter table public.partners
  add column if not exists deleted_at timestamptz,
  add column if not exists is_active boolean not null default true;

create index if not exists partners_active_idx
  on public.partners (is_active)
  where deleted_at is null;
