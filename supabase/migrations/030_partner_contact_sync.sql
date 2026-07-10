-- 담당자 명단 동기화: 이메일 이력, 매칭 신뢰도, 검토 플래그
alter table public.partner_contacts
  add column if not exists previous_emails text[] not null default '{}',
  add column if not exists match_confidence int,
  add column if not exists match_method text,
  add column if not exists review_required boolean not null default false,
  add column if not exists review_reason text,
  add column if not exists last_seen_in_full_sync_at timestamptz;

create index if not exists partner_contacts_review_required_idx
  on public.partner_contacts (partner_id)
  where review_required = true and deleted_at is null;

create index if not exists partner_contacts_active_partner_idx
  on public.partner_contacts (partner_id, is_active)
  where deleted_at is null;

comment on column public.partner_contacts.previous_emails is '이메일 변경 시 이전 주소 보관';
comment on column public.partner_contacts.last_seen_in_full_sync_at is '전체DB(contact_full_db_upload) 동기화에서 마지막으로 확인된 시각';
