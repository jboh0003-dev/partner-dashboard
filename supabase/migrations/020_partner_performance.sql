create table if not exists public.partner_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  snapshot_label text not null,
  source_file_name text not null,
  total_pipeline_amount_million numeric,
  total_pipeline_count int,
  partner_pipeline_amount_million numeric,
  partner_pipeline_count int,
  new_total_pipeline_amount_million numeric,
  new_total_pipeline_count int,
  new_partner_pipeline_amount_million numeric,
  new_partner_pipeline_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_date, snapshot_label)
);

create table if not exists public.partner_pipeline_opportunities (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.partner_performance_snapshots(id) on delete cascade,
  snapshot_date date not null,
  project_code text not null,
  customer_name text,
  project_name text,
  project_registered_year text,
  sales_owner text,
  division text,
  company text,
  org_path text,
  expected_win_year text,
  expected_win_quarter text,
  expected_win_month text,
  importance text,
  rfp_reflection text,
  win_probability_label text,
  win_probability_value numeric,
  win_status text,
  execution_status text,
  participation_type text,
  contract_owner text,
  expected_contract_partner text,
  is_partner_deal boolean not null default false,
  partner_grade text,
  partner_name text,
  matched_partner_id uuid references public.partners(id),
  is_product_revenue boolean not null default false,
  contract_type text,
  product_amount_million numeric,
  service_amount_million numeric,
  maintenance_amount_million numeric,
  total_amount_million numeric,
  product_contrabass numeric,
  product_contrabass_hci numeric,
  product_contrabass_legato numeric,
  product_viola numeric,
  product_cmp numeric,
  product_trombone numeric,
  product_trumpet numeric,
  product_symphony_ai numeric,
  product_tuba numeric,
  product_gaidsp numeric,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (snapshot_id, project_code)
);

create index if not exists idx_partner_pipeline_opportunities_snapshot
  on public.partner_pipeline_opportunities (snapshot_id);

create index if not exists idx_partner_pipeline_opportunities_partner
  on public.partner_pipeline_opportunities (matched_partner_id);

create index if not exists idx_partner_pipeline_opportunities_partner_name
  on public.partner_pipeline_opportunities (partner_name);

create table if not exists public.partner_revenue_records (
  id uuid primary key default gen_random_uuid(),
  revenue_year int not null,
  partner_name text not null,
  matched_partner_id uuid references public.partners(id),
  partner_grade text,
  sales_owner text,
  project_code text,
  customer_name text,
  project_name text,
  revenue_date date,
  product_revenue_million numeric,
  project_count int,
  source_sheet text,
  source_file_name text,
  raw_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_partner_revenue_records_year
  on public.partner_revenue_records (revenue_year);

create index if not exists idx_partner_revenue_records_partner
  on public.partner_revenue_records (matched_partner_id);

create index if not exists idx_partner_revenue_records_partner_name
  on public.partner_revenue_records (partner_name);
