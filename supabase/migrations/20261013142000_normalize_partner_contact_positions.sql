-- Standardize common partner contact job titles while preserving company-specific titles.
-- Examples:
--   전무이사 / 전무(본부장) / 전무/본부장 -> 전무
--   상무이사 -> 상무
--   기술이사 / 이사(팀장) / 이사/팀장 / 팀장/이사 -> 이사
--   부장(팀장) / 부장(수석연구원) / 부장/팀장 / 수석부장 -> 부장
-- Company-specific titles such as 리더, 매니저, Staff, GM, CTO remain unchanged.

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

    if compact_position in ('', '-', '없음', '해당없음', 'N/A', 'n/a') then
      new.position := null;
    elsif compact_position ~ '^대표이사([/(].*)?$' then
      new.position := '대표';
    elsif compact_position ~ '^전무(이사)?([/(].*)?$' then
      new.position := '전무';
    elsif compact_position ~ '^상무(이사)?([/(].*)?$' then
      new.position := '상무';
    elsif compact_position ~ '^(기술|영업|총괄|사내)?이사([/(].*)?$'
       or compact_position = '팀장/이사' then
      new.position := '이사';
    elsif compact_position ~ '^부장([/(].*)?$'
       or compact_position = '수석부장' then
      new.position := '부장';
    elsif compact_position ~ position_title_pattern then
      new.position := compact_position;
    end if;
  end if;

  return new;
end;
$$;

update public.partner_contacts
set position = position,
    updated_at = now()
where deleted_at is null
  and merged_into_contact_id is null
  and coalesce(is_active,true)=true
  and position is not null
  and (
    regexp_replace(position, '[[:space:]]+', '', 'g') in ('-','없음','해당없음','N/A','n/a','팀장/이사','수석부장')
    or regexp_replace(position, '[[:space:]]+', '', 'g') ~ '^대표이사([/(].*)?$'
    or regexp_replace(position, '[[:space:]]+', '', 'g') ~ '^전무(이사)?([/(].*)?$'
    or regexp_replace(position, '[[:space:]]+', '', 'g') ~ '^상무(이사)?([/(].*)?$'
    or regexp_replace(position, '[[:space:]]+', '', 'g') ~ '^(기술|영업|총괄|사내)?이사([/(].*)?$'
    or regexp_replace(position, '[[:space:]]+', '', 'g') ~ '^부장([/(].*)?$'
  );
