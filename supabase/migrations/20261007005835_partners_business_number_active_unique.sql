-- Allow soft-deleted partners to release their business number while
-- keeping business numbers unique among active partner records.

alter table public.partners
  drop constraint if exists partners_business_number_key;

create unique index if not exists partners_business_number_active_unique
  on public.partners (business_number)
  where deleted_at is null and business_number is not null;
