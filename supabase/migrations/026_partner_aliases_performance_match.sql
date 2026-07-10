-- 파트너 별칭 (엑셀 원본명 ↔ 등록 파트너)
create table if not exists public.partner_aliases (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  alias_name text not null,
  normalized_alias text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_alias)
);

create index if not exists idx_partner_aliases_partner_id
  on public.partner_aliases (partner_id);

create index if not exists idx_partner_aliases_normalized
  on public.partner_aliases (normalized_alias);

-- 파이프라인 영업기회 매칭 메타
alter table public.partner_pipeline_opportunities
  add column if not exists raw_partner_name text,
  add column if not exists matched_partner_name text,
  add column if not exists match_status text not null default 'unmatched',
  add column if not exists match_reason text,
  add column if not exists review_memo text;

create index if not exists idx_partner_pipeline_opportunities_match_status
  on public.partner_pipeline_opportunities (match_status);

-- 매출 실적 매칭 메타
alter table public.partner_revenue_records
  add column if not exists raw_partner_name text,
  add column if not exists match_status text not null default 'unmatched',
  add column if not exists match_reason text;

-- 수동 매칭 검토 이력
create table if not exists public.performance_match_reviews (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.partner_pipeline_opportunities(id) on delete set null,
  revenue_record_id uuid references public.partner_revenue_records(id) on delete set null,
  action text not null,
  raw_partner_name text,
  partner_id uuid references public.partners(id) on delete set null,
  alias_name text,
  reviewer_note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_performance_match_reviews_opportunity
  on public.performance_match_reviews (opportunity_id);
