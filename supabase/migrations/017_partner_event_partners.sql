-- 행사 ↔ 파트너 수동 연결 (참석자 명단 자동 매칭 확장용)
create table if not exists public.partner_event_partners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.partner_events(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  relation_type text not null default '관련',
  source text not null default 'manual',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, partner_id)
);

create index if not exists partner_event_partners_event_idx
  on public.partner_event_partners (event_id);

create index if not exists partner_event_partners_partner_idx
  on public.partner_event_partners (partner_id);

alter table public.partner_event_partners enable row level security;

create policy "authenticated read partner_event_partners"
on public.partner_event_partners for select
to authenticated
using (true);

create policy "authenticated insert partner_event_partners"
on public.partner_event_partners for insert
to authenticated
with check (true);

create policy "authenticated delete partner_event_partners"
on public.partner_event_partners for delete
to authenticated
using (true);

create policy "authenticated update partner_event_partners"
on public.partner_event_partners for update
to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
