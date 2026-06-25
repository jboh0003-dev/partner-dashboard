-- partner_documents.summary (003 누락 환경 보완)
alter table public.partner_documents
  add column if not exists summary text;

comment on column public.partner_documents.summary is '문서 요약/비고 (note와 동기화 가능)';

-- PostgREST / Supabase API schema cache reload
notify pgrst, 'reload schema';
