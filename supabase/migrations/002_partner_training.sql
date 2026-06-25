-- 002_partner_training.sql
-- 1. partners 테이블 컬럼 확장 (엑셀 import 대응)

alter table public.partners
  add column if not exists primary_email text,
  add column if not exists grade_raw text,
  add column if not exists has_training boolean not null default false,
  add column if not exists theory_only boolean not null default false,
  add column if not exists has_sales_opportunity boolean not null default false,
  add column if not exists data_quality_warning text;

create index if not exists partners_company_name_idx
  on public.partners (company_name);

create index if not exists partners_grade_idx
  on public.partners (grade);

create index if not exists partners_contract_start_date_idx
  on public.partners (contract_start_date);

-- 2. 월별 교육 이력 테이블

create table if not exists public.partner_training_monthly (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  training_year int not null,
  training_month int not null check (training_month between 1 and 12),
  training_label text,
  attended boolean not null default false,
  raw_value text,
  created_at timestamptz not null default now(),
  unique (partner_id, training_year, training_month)
);

create index if not exists partner_training_monthly_partner_idx
  on public.partner_training_monthly (partner_id);

create index if not exists partner_training_monthly_yearmonth_idx
  on public.partner_training_monthly (training_year, training_month);

-- 3. RLS 정책 (1차 init과 동일 패턴; 현재는 RLS off 상태이지만 대비)

alter table public.partner_training_monthly enable row level security;

drop policy if exists "authenticated read partner_training_monthly"
  on public.partner_training_monthly;

create policy "authenticated read partner_training_monthly"
on public.partner_training_monthly for select
to authenticated
using (true);

drop policy if exists "admins manage partner_training_monthly"
  on public.partner_training_monthly;

create policy "admins manage partner_training_monthly"
on public.partner_training_monthly for all
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
