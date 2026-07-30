-- 대시보드/목록 조회 성능용 인덱스 (non-destructive)
-- 대상 쿼리:
--   partners: region_group 집계, is_active 필터
--   training_attendance: partner_id count
--   partner_documents: storage_path 조인/고아 탐지

create index if not exists partners_region_group_idx
  on public.partners (region_group);

create index if not exists training_attendance_partner_id_idx
  on public.training_attendance (partner_id);

create index if not exists partner_documents_storage_path_idx
  on public.partner_documents (storage_path)
  where storage_path is not null;

create index if not exists partner_documents_file_path_idx
  on public.partner_documents (file_path)
  where file_path is not null;
