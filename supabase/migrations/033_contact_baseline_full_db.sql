-- 전체DB baseline: 현재 인력/담당자 Source of Truth 플래그
alter table public.partner_contacts
  add column if not exists in_current_full_db boolean not null default false;

create index if not exists partner_contacts_current_full_db_idx
  on public.partner_contacts (partner_id, in_current_full_db)
  where deleted_at is null and merged_into_contact_id is null and in_current_full_db = true;

comment on column public.partner_contacts.in_current_full_db is '최신 전체DB.xlsx baseline에 포함된 현재 인력 여부';

-- 기존 active + 전체DB sync 이력이 있는 contact는 baseline 포함으로 간주
update public.partner_contacts
set in_current_full_db = true
where is_active = true
  and deleted_at is null
  and merged_into_contact_id is null
  and last_seen_in_full_sync_at is not null;
