-- 연락처 정규화: raw / normalized / display 분리
alter table public.contact_phones
  add column if not exists raw_phone text,
  add column if not exists display_phone text,
  add column if not exists needs_review boolean not null default false;

alter table public.partner_contacts
  add column if not exists phone_raw text,
  add column if not exists phone_normalized text,
  add column if not exists phone_display text;

comment on column public.contact_phones.raw_phone is '업로드/입력 원본 연락처';
comment on column public.contact_phones.display_phone is '화면 표시용 하이픈 포맷 연락처';
comment on column public.contact_phones.needs_review is '연락처 형식 확인 필요 여부';
comment on column public.partner_contacts.phone_raw is '대표 연락처 원본값';
comment on column public.partner_contacts.phone_normalized is '대표 연락처 정규화 숫자';
comment on column public.partner_contacts.phone_display is '대표 연락처 화면 표시값';

-- 기존 raw 백필
update public.contact_phones
set raw_phone = coalesce(raw_phone, phone)
where raw_phone is null;

update public.partner_contacts
set phone_raw = coalesce(phone_raw, phone)
where phone is not null
  and trim(phone) <> ''
  and phone_raw is null;

-- 엑셀 숫자형으로 앞자리 0이 빠진 10자리(10xxxxxxxx) 보정
update public.contact_phones
set normalized_phone = '0' || normalized_phone
where length(normalized_phone) = 10
  and normalized_phone like '10%';

update public.partner_contacts
set phone_normalized = '0' || phone_normalized
where phone_normalized is not null
  and length(phone_normalized) = 10
  and phone_normalized like '10%';

-- display_phone / phone_display은 앱 스크립트(normalize:phones:run)로 일괄 포맷
