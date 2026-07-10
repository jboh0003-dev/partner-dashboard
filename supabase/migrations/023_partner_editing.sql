-- 파트너/담당자 대시보드 직접 수정 지원

alter table public.partners
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists edited_via_dashboard_at timestamptz;

alter table public.partner_contacts
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists edited_via_dashboard_at timestamptz;

create index if not exists partner_contacts_active_idx
  on public.partner_contacts (partner_id, is_active)
  where deleted_at is null;

create table if not exists public.partner_change_logs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  entity_type text not null check (entity_type in ('partner', 'contact')),
  entity_id uuid not null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  reason text
);

create index if not exists partner_change_logs_partner_idx
  on public.partner_change_logs (partner_id, changed_at desc);

alter table public.partner_change_logs enable row level security;

drop policy if exists "authenticated read partner_change_logs" on public.partner_change_logs;
create policy "authenticated read partner_change_logs"
on public.partner_change_logs for select
to authenticated
using (true);

drop policy if exists "admins manage partner_change_logs" on public.partner_change_logs;
create policy "admins manage partner_change_logs"
on public.partner_change_logs for all
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);
