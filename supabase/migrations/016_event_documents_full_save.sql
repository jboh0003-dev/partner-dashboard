-- 행사 자료: 전체 저장 + 대표자료 표시 (file_status / visibility / bucket)
alter table public.partner_event_documents
  add column if not exists file_status text;

update public.partner_event_documents
set file_status = case
  when is_representative = true then 'representative'
  when is_duplicate = true then 'duplicate'
  when upload_status = 'internal_only' or is_internal = true then 'internal'
  when upload_status = 'exclude' and coalesce(exclude_reason, '') ilike '%복사%' then 'duplicate'
  when upload_status = 'exclude' and coalesce(exclude_reason, '') ilike '%버전%' then 'old_version'
  when upload_status = 'exclude' and (
    coalesce(exclude_reason, '') ilike '%초안%'
    or coalesce(exclude_reason, '') ilike '%작업%'
    or coalesce(exclude_reason, '') ilike '%중간%'
  ) then 'draft'
  when upload_status = 'exclude' then 'excluded'
  when upload_status = 'upload_recommended' then 'normal'
  else 'normal'
end
where file_status is null;

alter table public.partner_event_documents
  alter column file_status set default 'normal';

update public.partner_event_documents
set visibility = case
  when visibility = 'internal' or is_internal = true then 'admin_only'
  else 'internal_all'
end
where visibility is null or visibility in ('public', 'internal');

update public.partner_events
set visibility = case
  when visibility = 'internal' then 'admin_only'
  else 'internal_all'
end
where visibility is null or visibility in ('public', 'internal');

alter table public.partner_event_curation_items
  add column if not exists file_status text;

create index if not exists partner_event_documents_file_status_idx
  on public.partner_event_documents (event_id, file_status);

create index if not exists partner_event_documents_source_path_idx
  on public.partner_event_documents (event_id, source_path);

insert into storage.buckets (id, name, public)
values ('event-documents', 'event-documents', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
