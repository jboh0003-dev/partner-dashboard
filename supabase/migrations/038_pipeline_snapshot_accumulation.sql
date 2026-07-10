-- 파이프라인 스냅샷 누적 저장 (전체DB baseline reset 과 분리)
-- partner_performance_snapshots = pipeline_snapshots 역할

alter table public.partner_performance_snapshots
  add column if not exists is_current boolean not null default false,
  add column if not exists uploaded_at timestamptz not null default now(),
  add column if not exists uploaded_by text,
  add column if not exists version int not null default 1;

comment on column public.partner_performance_snapshots.is_current is
  '대시보드 표시용 최신 스냅샷 (snapshot_date·uploaded_at 기준 자동 갱신)';
comment on column public.partner_performance_snapshots.version is
  '동일 기준일+파일명 재업로드 시 버전 (replace=유지, new_version=증가)';

alter table public.partner_performance_snapshots
  drop constraint if exists partner_performance_snapshots_snapshot_date_snapshot_label_key;

create unique index if not exists idx_partner_performance_snapshots_date_file_version
  on public.partner_performance_snapshots (snapshot_date, source_file_name, version);

create unique index if not exists idx_partner_performance_snapshots_single_current
  on public.partner_performance_snapshots (is_current)
  where is_current = true;

create index if not exists idx_partner_performance_snapshots_timeline
  on public.partner_performance_snapshots (snapshot_date asc, uploaded_at asc);
