-- 수동 확인·제외 처리 시각 (기존 데이터 삭제 없음)
alter table public.partner_documents
  add column if not exists review_resolved_at timestamptz;

comment on column public.partner_documents.review_resolved_at is
  '확인 필요 해소(수동 확인·제외) 처리 시각';
