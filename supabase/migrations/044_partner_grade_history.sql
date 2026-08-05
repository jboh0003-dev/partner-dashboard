-- Platinum upgrade grade change audit trail
-- Non-destructive. Does not alter existing partner grades.

create table if not exists public.partner_grade_history (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  previous_grade text,
  new_grade text not null,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  changed_by_email text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists partner_grade_history_partner_idx
  on public.partner_grade_history (partner_id, changed_at desc);

create index if not exists partner_grade_history_changed_at_idx
  on public.partner_grade_history (changed_at desc);

alter table public.partner_grade_history enable row level security;

revoke all on public.partner_grade_history from anon, authenticated;

comment on table public.partner_grade_history is
  'Partner grade change history (previous/new grade, changed_at, changed_by)';

notify pgrst, 'reload schema';
