-- 041: 파트너 신청서 등록용 nullable 컬럼 (비파괴)
-- DROP / TRUNCATE / 전체 DELETE 없음

alter table public.partners
  add column if not exists engineer_count text,
  add column if not exists founded_date date,
  add column if not exists dedicated_sales_count text,
  add column if not exists dedicated_engineer_count text,
  add column if not exists contract_display_name text;

comment on column public.partners.engineer_count is '전체 엔지니어 수 (신청서)';
comment on column public.partners.founded_date is '설립일자';
comment on column public.partners.dedicated_sales_count is '오케스트로 전담 영업인원 수';
comment on column public.partners.dedicated_engineer_count is '오케스트로 전담 기술인원 수';
comment on column public.partners.contract_display_name is '계약서 표기 회사명 (DB 표시명과 분리)';

-- 신청서 문서 중복 방지 (동일 해시 재업로드 억제)
create unique index if not exists partner_documents_application_hash_uidx
  on public.partner_documents (partner_id, document_type, file_hash)
  where deleted_at is null
    and document_type = 'partner_application'
    and file_hash is not null;
