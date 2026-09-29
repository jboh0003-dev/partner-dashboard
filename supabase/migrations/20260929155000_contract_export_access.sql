alter table public.profiles
  add column if not exists contract_export_enabled boolean not null default false;
