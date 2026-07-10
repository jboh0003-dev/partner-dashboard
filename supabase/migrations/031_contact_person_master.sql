-- 사람 마스터: 이메일/연락처/담당구분 다중값 + 병합 추적
alter table public.partner_contacts
  add column if not exists merged_into_contact_id uuid references public.partner_contacts(id) on delete set null;

create index if not exists partner_contacts_merged_into_idx
  on public.partner_contacts (merged_into_contact_id)
  where merged_into_contact_id is not null;

create index if not exists partner_contacts_person_key_idx
  on public.partner_contacts (partner_id, name)
  where deleted_at is null and merged_into_contact_id is null;

create table if not exists public.contact_emails (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.partner_contacts(id) on delete cascade,
  email text not null,
  is_primary boolean not null default false,
  is_bounced boolean not null default false,
  is_sendable boolean not null default true,
  source text,
  created_at timestamptz not null default now(),
  unique (contact_id, email)
);

create table if not exists public.contact_phones (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.partner_contacts(id) on delete cascade,
  phone text not null,
  normalized_phone text not null,
  is_primary boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  unique (contact_id, normalized_phone)
);

create table if not exists public.contact_roles (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.partner_contacts(id) on delete cascade,
  role_name text not null,
  source text,
  created_at timestamptz not null default now(),
  unique (contact_id, role_name)
);

create index if not exists contact_emails_contact_idx on public.contact_emails (contact_id);
create index if not exists contact_phones_contact_idx on public.contact_phones (contact_id);
create index if not exists contact_roles_contact_idx on public.contact_roles (contact_id);

comment on column public.partner_contacts.merged_into_contact_id is '병합되어 대표 contact로 흡수된 row';
comment on table public.contact_emails is '담당자 이메일 다중값 (partner_contacts.email = 대표)';
comment on table public.contact_phones is '담당자 연락처 다중값 (partner_contacts.phone = 대표)';
comment on table public.contact_roles is '담당구분 다중값';

-- 기존 flat email/phone/role을 child 테이블로 백필
insert into public.contact_emails (contact_id, email, is_primary, source)
select pc.id, lower(trim(pc.email)), true, coalesce(pc.source_file, 'migration_backfill')
from public.partner_contacts pc
where pc.email is not null
  and trim(pc.email) <> ''
  and pc.deleted_at is null
on conflict (contact_id, email) do nothing;

insert into public.contact_phones (contact_id, phone, normalized_phone, is_primary, source)
select
  pc.id,
  trim(pc.phone),
  regexp_replace(pc.phone, '[^0-9]', '', 'g'),
  true,
  coalesce(pc.source_file, 'migration_backfill')
from public.partner_contacts pc
where pc.phone is not null
  and trim(pc.phone) <> ''
  and regexp_replace(pc.phone, '[^0-9]', '', 'g') <> ''
  and pc.deleted_at is null
on conflict (contact_id, normalized_phone) do nothing;

insert into public.contact_roles (contact_id, role_name, source)
select distinct on (pc.id, role_label)
  pc.id,
  role_label,
  coalesce(pc.source_file, 'migration_backfill')
from public.partner_contacts pc
cross join lateral (
  select unnest(
    array_remove(
      array[
        case when pc.is_contract_contact then '계약담당자' end,
        case when pc.role_raw is not null and trim(pc.role_raw) <> '' then trim(pc.role_raw) end,
        case
          when pc.role_type = 'sales' then '영업'
          when pc.role_type = 'engineer' then '엔지니어'
          when pc.role_type = 'admin' then '관리'
          when pc.role_type = 'executive' then '대표/경영'
          when pc.role_type = 'contract' then '계약담당'
          when pc.role_type = 'etc' and (pc.role_raw is null or trim(pc.role_raw) = '') then '일반 담당자'
          else null
        end
      ],
      null
    )
  ) as role_label
) roles
where pc.deleted_at is null
  and role_label is not null
on conflict (contact_id, role_name) do nothing;

insert into public.contact_emails (contact_id, email, is_primary, source)
select pc.id, lower(trim(prev)), false, 'previous_emails_backfill'
from public.partner_contacts pc
cross join lateral unnest(coalesce(pc.previous_emails, '{}')) as prev
where pc.deleted_at is null
  and prev is not null
  and trim(prev) <> ''
on conflict (contact_id, email) do nothing;
