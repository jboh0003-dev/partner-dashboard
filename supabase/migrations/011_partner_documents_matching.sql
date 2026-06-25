-- partner_documents 매칭/표시 메타데이터 확장
alter table public.partner_documents
  add column if not exists extracted_partner_name text,
  add column if not exists match_confidence int,
  add column if not exists match_status text default 'matched',
  add column if not exists match_method text;

update public.partner_documents
set
  extracted_partner_name = coalesce(extracted_partner_name, partner_name_raw),
  match_status = case
    when review_status = 'needs_review' then 'needs_review'
    when review_status = 'skipped' then 'unmatched'
    else coalesce(match_status, 'matched')
  end,
  match_method = coalesce(
    match_method,
    case match_source
      when 'folder' then 'includes'
      when 'filename' then 'includes'
      when 'partner_no' then 'exact'
      when 'fuzzy' then 'fuzzy'
      when 'manual' then 'manual'
      else null
    end
  ),
  match_confidence = coalesce(match_confidence, case when review_status = 'auto_matched' then 90 else 0 end)
where extracted_partner_name is null
   or match_status is null
   or match_confidence is null;

notify pgrst, 'reload schema';
