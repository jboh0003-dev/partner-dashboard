-- 중복 병합: 사용자가 별도 인물로 유지하기로 한 contact
alter table public.partner_contacts
  add column if not exists merge_keep_separate boolean not null default false;

comment on column public.partner_contacts.merge_keep_separate is '중복 후보이지만 별도 인물로 유지';

create index if not exists partner_contacts_merge_keep_separate_idx
  on public.partner_contacts (partner_id, name)
  where merge_keep_separate = true and deleted_at is null and merged_into_contact_id is null;
