-- Partner application portal (external apply + admin review)
-- Non-destructive. Does not alter existing partners table data.

create extension if not exists pgcrypto;

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  application_number text not null unique,
  status text not null default 'draft'
    check (status in (
      'draft', 'submitted', 'under_review', 'revision_requested',
      'approved', 'rejected', 'contracted'
    )),
  access_token_hash text not null,
  lookup_password_hash text,
  company_name text,
  business_registration_number text,
  business_number_normalized text,
  representative_name text,
  established_date date,
  established_date_display text,
  address text,
  website text,
  credit_grade text,
  revenue text,
  total_employees integer,
  total_engineers integer,
  dedicated_sales_count integer,
  dedicated_technical_count integer,
  contact_name text,
  contact_position text,
  contact_department text,
  contact_phone text,
  contact_email text,
  contact_office_phone text,
  technical_collaboration_requested boolean not null default false,
  platinum_review_requested boolean not null default false,
  sales_strategy text,
  applicant_name text,
  applicant_email text,
  form_payload jsonb not null default '{}'::jsonb,
  missing_required_count integer not null default 0,
  revision_reason text,
  admin_memo text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  approved_partner_id uuid references public.partners(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_applications_status_idx
  on public.partner_applications (status);
create index if not exists partner_applications_bn_norm_idx
  on public.partner_applications (business_number_normalized);
create index if not exists partner_applications_company_idx
  on public.partner_applications (company_name);
create index if not exists partner_applications_submitted_idx
  on public.partner_applications (submitted_at desc nulls last);

create table if not exists public.partner_application_people (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.partner_applications(id) on delete cascade,
  section text not null check (section in ('ceo', 'sales', 'engineer', 'contract_contact')),
  sort_order integer not null default 0,
  duty text,
  department text,
  name text,
  position text,
  phone text,
  email text,
  note text,
  skill_level text,
  main_skills text,
  created_at timestamptz not null default now()
);
create index if not exists partner_application_people_app_idx
  on public.partner_application_people (application_id, section, sort_order);

create table if not exists public.partner_application_customers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.partner_applications(id) on delete cascade,
  sort_order integer not null default 0,
  customer_name text,
  proposal_status text,
  business_timing text,
  revenue_target text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists partner_application_customers_app_idx
  on public.partner_application_customers (application_id, sort_order);

create table if not exists public.partner_application_equipment (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.partner_applications(id) on delete cascade,
  sort_order integer not null default 0,
  equipment_name text,
  model text,
  quantity text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists partner_application_equipment_app_idx
  on public.partner_application_equipment (application_id, sort_order);

create table if not exists public.partner_application_engineers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.partner_applications(id) on delete cascade,
  profile_sheet integer not null default 1 check (profile_sheet in (1, 2)),
  sort_order integer not null default 0,
  name text,
  career_years text,
  main_skills text,
  certifications text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists partner_application_engineers_app_idx
  on public.partner_application_engineers (application_id, profile_sheet, sort_order);

create table if not exists public.partner_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.partner_applications(id) on delete cascade,
  document_type text not null,
  file_name text not null,
  storage_path text not null,
  file_ext text,
  file_size bigint,
  file_hash text,
  mime_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists partner_application_documents_app_idx
  on public.partner_application_documents (application_id, document_type, is_active);

create table if not exists public.partner_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.partner_applications(id) on delete cascade,
  event_type text not null,
  message text,
  actor_user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists partner_application_events_app_idx
  on public.partner_application_events (application_id, created_at desc);

-- Storage bucket for application attachments (private)
insert into storage.buckets (id, name, public)
values ('partner-applications', 'partner-applications', false)
on conflict (id) do nothing;

alter table public.partner_applications enable row level security;
alter table public.partner_application_people enable row level security;
alter table public.partner_application_customers enable row level security;
alter table public.partner_application_equipment enable row level security;
alter table public.partner_application_engineers enable row level security;
alter table public.partner_application_documents enable row level security;
alter table public.partner_application_events enable row level security;

-- No direct anon/authenticated table access; all via service role API routes.
-- Keep policies explicit for defense in depth (deny-by-default with RLS enabled and no grants).

revoke all on public.partner_applications from anon, authenticated;
revoke all on public.partner_application_people from anon, authenticated;
revoke all on public.partner_application_customers from anon, authenticated;
revoke all on public.partner_application_equipment from anon, authenticated;
revoke all on public.partner_application_engineers from anon, authenticated;
revoke all on public.partner_application_documents from anon, authenticated;
revoke all on public.partner_application_events from anon, authenticated;

comment on table public.partner_applications is 'External partner apply portal submissions (pre-partner DB)';
