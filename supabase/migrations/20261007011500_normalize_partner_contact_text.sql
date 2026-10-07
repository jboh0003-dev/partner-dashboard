-- Normalize Korean contact names and common job-title spacing at the database boundary.
-- This keeps all write paths consistent: Excel imports, partner applications, manual edits, and sync jobs.

create or replace function public.normalize_partner_contact_text()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  compact_position text;
  position_title_pattern constant text :=
    '^(대표|대표이사|회장|부회장|사장|부사장|전무|상무|이사|본부장|실장|센터장|사업부장|부장|차장|과장|대리|주임|사원|팀장|팀원|수석|책임|선임|연구원|매니저|프로)(/(대표|대표이사|회장|부회장|사장|부사장|전무|상무|이사|본부장|실장|센터장|사업부장|부장|차장|과장|대리|주임|사원|팀장|팀원|수석|책임|선임|연구원|매니저|프로))*$';
begin
  if new.name is not null then
    new.name := btrim(regexp_replace(new.name, '[[:space:]]+', ' ', 'g'));
    if new.name ~ '^[가-힣 ]+$' then
      new.name := regexp_replace(new.name, '[[:space:]]+', '', 'g');
    end if;
  end if;

  if new.position is not null then
    new.position := btrim(regexp_replace(new.position, '[[:space:]]+', ' ', 'g'));
    new.position := regexp_replace(new.position, '[[:space:]]*/[[:space:]]*', '/', 'g');
    compact_position := regexp_replace(new.position, '[[:space:]]+', '', 'g');

    if compact_position ~ position_title_pattern then
      new.position := compact_position;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_partner_contact_text_before_write
  on public.partner_contacts;

create trigger normalize_partner_contact_text_before_write
before insert or update of name, position
on public.partner_contacts
for each row
execute function public.normalize_partner_contact_text();

-- Backfill currently active contacts once so existing rows follow the same rule.
update public.partner_contacts
set
  name = name,
  position = position,
  updated_at = coalesce(updated_at, now())
where deleted_at is null
  and merged_into_contact_id is null
  and coalesce(is_active, true) = true
  and (
    name ~ '^[가-힣]+[[:space:]]+[가-힣[:space:]]*$'
    or position ~ '[[:space:]]'
    or position ~ '/[[:space:]]+'
  );
