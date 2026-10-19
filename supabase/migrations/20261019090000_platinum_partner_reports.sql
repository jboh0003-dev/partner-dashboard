create table public.platinum_partner_reports (
 partner_id uuid primary key references public.partners(id),
 source_date date not null,
 payload jsonb not null check (jsonb_typeof(payload) = 'object'),
 overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(overrides) = 'object'),
 version integer not null default 1 check (version > 0),
 updated_at timestamptz not null default now()
);
alter table public.platinum_partner_reports enable row level security;
revoke all on public.platinum_partner_reports from anon, authenticated;
grant select, insert, update on public.platinum_partner_reports to authenticated;
grant all on public.platinum_partner_reports to service_role;
create policy "internal users read platinum reports" on public.platinum_partner_reports
for select to authenticated using (exists (
 select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','viewer','user')
));
create policy "admins insert platinum reports" on public.platinum_partner_reports
for insert to authenticated with check (public.is_profile_admin());
create policy "admins update platinum reports" on public.platinum_partner_reports
for update to authenticated using (public.is_profile_admin()) with check (public.is_profile_admin());
comment on table public.platinum_partner_reports is 'Source-based platinum partner reporting; original facts and verified corrections stored separately. No public access.';
