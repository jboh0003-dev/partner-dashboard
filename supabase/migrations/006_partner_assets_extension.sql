-- 장비/리소스 확장 컬럼
alter table public.partner_assets
  add column if not exists spec_summary text,
  add column if not exists partner_name_raw text,
  add column if not exists match_status text default 'matched',
  add column if not exists source_file text,
  add column if not exists last_synced_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists set_partner_assets_updated_at on public.partner_assets;
create trigger set_partner_assets_updated_at
before update on public.partner_assets
for each row
execute function public.set_updated_at();

create index if not exists partner_assets_partner_id_idx
  on public.partner_assets (partner_id);

create index if not exists partner_assets_match_status_idx
  on public.partner_assets (match_status);
