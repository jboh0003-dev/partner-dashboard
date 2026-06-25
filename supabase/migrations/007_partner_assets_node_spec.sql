-- 파트너 장비 노드 단위 스펙 컬럼
alter table public.partner_assets
  add column if not exists asset_group text,
  add column if not exists node_type text,
  add column if not exists node_name text,
  add column if not exists form_factor text,
  add column if not exists cpu text,
  add column if not exists memory text,
  add column if not exists os_disk text,
  add column if not exists ceph_disk text,
  add column if not exists nic text,
  add column if not exists asset_status text;

create index if not exists partner_assets_node_name_idx
  on public.partner_assets (partner_id, node_name);

create index if not exists partner_assets_asset_status_idx
  on public.partner_assets (asset_status);

create index if not exists partner_assets_node_type_idx
  on public.partner_assets (node_type);
