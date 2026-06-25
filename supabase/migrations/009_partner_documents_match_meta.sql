-- partner_documents 매칭 메타데이터
alter table public.partner_documents
  add column if not exists match_source text,
  add column if not exists review_status text default 'auto_matched';

update public.partner_documents
set review_status = coalesce(review_status, 'auto_matched')
where review_status is null;
