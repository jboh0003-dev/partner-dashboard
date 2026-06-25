create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'user' check (role in ('admin', 'user', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  business_number text unique,
  grade text default 'silver',
  status text not null default 'active',
  ceo_name text,
  address text,
  website text,
  main_phone text,
  contract_start_date date,
  contract_end_date date,
  sales_owner text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_contacts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  name text not null,
  department text,
  position text,
  role_type text,
  email text,
  phone text,
  is_primary boolean not null default false,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_type text,
  event_date date,
  location text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  attendee_name text,
  attendee_department text,
  attendee_position text,
  attendee_email text,
  attended boolean not null default true,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  training_name text not null,
  training_type text,
  product_name text,
  training_year int,
  training_month int,
  start_date date,
  end_date date,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.training_attendance (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  training_id uuid not null references public.trainings(id) on delete cascade,
  attendee_name text,
  attendee_department text,
  attendee_position text,
  attendee_email text,
  attended boolean not null default true,
  score numeric,
  evaluation_result text,
  evaluation_memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_assets (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  asset_type text,
  asset_name text,
  vendor text,
  model_name text,
  quantity int default 1,
  status text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_notes (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  note_type text default 'general',
  title text,
  content text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.partner_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  document_type text,
  file_name text not null,
  file_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_partners_updated_at on public.partners;
create trigger set_partners_updated_at
before update on public.partners
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.partners enable row level security;
alter table public.partner_contacts enable row level security;
alter table public.events enable row level security;
alter table public.event_attendance enable row level security;
alter table public.trainings enable row level security;
alter table public.training_attendance enable row level security;
alter table public.partner_assets enable row level security;
alter table public.partner_notes enable row level security;
alter table public.partner_documents enable row level security;

create policy "profiles read own"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "profiles insert own"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "authenticated read partners"
on public.partners for select
to authenticated
using (true);

create policy "authenticated read contacts"
on public.partner_contacts for select
to authenticated
using (true);

create policy "authenticated read events"
on public.events for select
to authenticated
using (true);

create policy "authenticated read event_attendance"
on public.event_attendance for select
to authenticated
using (true);

create policy "authenticated read trainings"
on public.trainings for select
to authenticated
using (true);

create policy "authenticated read training_attendance"
on public.training_attendance for select
to authenticated
using (true);

create policy "authenticated read assets"
on public.partner_assets for select
to authenticated
using (true);

create policy "authenticated read notes"
on public.partner_notes for select
to authenticated
using (true);

create policy "authenticated read documents"
on public.partner_documents for select
to authenticated
using (true);

create policy "admins manage partners"
on public.partners for all
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

create policy "admins manage contacts"
on public.partner_contacts for all
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

create policy "admins manage notes"
on public.partner_notes for all
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
