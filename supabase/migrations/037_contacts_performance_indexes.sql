-- contacts 목록 조회 성능 인덱스

create index if not exists partner_contacts_current_active_idx
  on public.partner_contacts (in_current_full_db, is_active)
  where deleted_at is null and merged_into_contact_id is null;

create index if not exists partner_contacts_deleted_at_idx
  on public.partner_contacts (deleted_at)
  where deleted_at is null;

create index if not exists partner_contacts_partner_name_idx
  on public.partner_contacts (partner_id, name)
  where deleted_at is null and merged_into_contact_id is null;

create index if not exists partner_contacts_review_required_idx
  on public.partner_contacts (review_required, in_current_full_db)
  where deleted_at is null and merged_into_contact_id is null and review_required = true;

create index if not exists contact_emails_bounced_idx
  on public.contact_emails (contact_id)
  where is_bounced = true or is_sendable = false;
