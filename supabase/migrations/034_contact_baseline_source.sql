-- baseline source + repair helper
alter table public.partner_contacts
  add column if not exists contact_source text;

comment on column public.partner_contacts.contact_source is 'full_db | education | event | manual 등 contact 유입 경로';

create index if not exists partner_contacts_baseline_active_idx
  on public.partner_contacts (in_current_full_db, is_active)
  where deleted_at is null and merged_into_contact_id is null;

-- 최근 full sync 이력이 있는데 baseline 플래그가 꺼진 row 복구
update public.partner_contacts
set
  in_current_full_db = true,
  is_active = true,
  contact_source = coalesce(contact_source, 'full_db')
where deleted_at is null
  and merged_into_contact_id is null
  and last_seen_in_full_sync_at is not null
  and in_current_full_db = false
  and is_active = true;
