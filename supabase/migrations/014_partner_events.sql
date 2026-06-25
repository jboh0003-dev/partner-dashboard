-- 파트너 행사 자료 관리 (기존 events 테이블은 유지)
create table if not exists public.partner_events (
  id uuid primary key default gen_random_uuid(),
  year int,
  event_name text not null,
  event_type text,
  event_date date,
  location text,
  description text,
  summary text,
  related_partners text,
  source_folder_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_events_year_idx on public.partner_events (year);
create index if not exists partner_events_type_idx on public.partner_events (event_type);
create index if not exists partner_events_date_idx on public.partner_events (event_date desc);

create table if not exists public.partner_event_documents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.partner_events(id) on delete cascade,
  document_type text,
  display_name text not null,
  original_file_name text,
  storage_path text,
  uploaded_at timestamptz not null default now()
);

create index if not exists partner_event_documents_event_idx
  on public.partner_event_documents (event_id);

alter table public.partner_events enable row level security;
alter table public.partner_event_documents enable row level security;

create policy "authenticated read partner_events"
on public.partner_events for select
to authenticated
using (true);

create policy "authenticated read partner_event_documents"
on public.partner_event_documents for select
to authenticated
using (true);

-- partner_knowledge created_at 보강
alter table public.partner_knowledge
  add column if not exists created_at timestamptz default now();

-- 샘플 행사 (폴더명 기반)
insert into public.partner_events (
  year, event_name, event_type, event_date, description, summary, source_folder_name
)
values
  (
    2024,
    '파트너 데이_w티맥스',
    '파트너데이',
    '2024-11-28',
    '파트너사를 대상으로 주요 사업 방향, 정책, 협력 전략을 공유한 행사입니다.',
    '2024년 11월 파트너 데이 행사 자료',
    '파트너 데이_w티맥스 (241128)'
  ),
  (
    2025,
    '솔루션데이',
    '솔루션데이',
    '2025-09-02',
    '솔루션 및 제품 메시지를 공유하고 고객/파트너 대상 세일즈 활동을 지원하기 위한 행사입니다.',
    '2025년 솔루션데이 발표 자료',
    '솔루션데이 (250902)'
  ),
  (
    2026,
    '부산세미나',
    '세미나',
    '2026-04-23',
    '특정 주제 또는 지역 파트너/고객을 대상으로 진행된 세미나입니다.',
    '2026년 부산 지역 세미나 자료',
    '부산세미나 (26.04.23)'
  ),
  (
    2026,
    '파트너데이',
    '파트너데이',
    '2026-03-18',
    '파트너사를 대상으로 주요 사업 방향, 정책, 협력 전략을 공유한 행사입니다.',
    '2026년 파트너데이 행사 자료',
    '파트너데이 (26.03.18)'
  ),
  (
    2025,
    '플래티넘 파트너 간담회',
    '간담회',
    '2025-07-15',
    '주요 파트너사와 협력 현황 및 향후 추진 방향을 논의한 간담회입니다.',
    '플래티넘 등급 파트너 대상 간담회',
    '플래티넘 파트너 간담회 (250715)'
  )
on conflict do nothing;

-- 샘플 행사 문서 (storage_path는 추후 업로드 연결용)
insert into public.partner_event_documents (event_id, document_type, display_name, original_file_name, storage_path)
select
  e.id,
  'presentation',
  e.event_name || ' 발표자료',
  e.source_folder_name || '/발표자료.pdf',
  'events/' || e.source_folder_name || '/발표자료.pdf'
from public.partner_events e
where not exists (
  select 1 from public.partner_event_documents d where d.event_id = e.id
);

notify pgrst, 'reload schema';
