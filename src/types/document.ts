export type PartnerDocument = {
  id: string;
  partner_id: string;
  partner_name_raw: string | null;
  document_type: string | null;
  document_status: string | null;
  original_filename: string | null;
  display_name: string | null;
  file_name: string;
  file_path: string | null;
  storage_path: string | null;
  file_url: string | null;
  file_ext: string | null;
  file_size: number | null;
  source_folder: string | null;
  source_file: string | null;
  received_date: string | null;
  contract_date: string | null;
  partner_no: string | null;
  grade_from_file: string | null;
  period_year: number | null;
  period_quarter: string | null;
  period_month: number | null;
  is_primary: boolean | null;
  priority_score: number | null;
  is_active: boolean | null;
  is_duplicate: boolean | null;
  duplicate_of: string | null;
  duplicate_reason: string | null;
  representative: boolean | null;
  upload_batch_id: string | null;
  file_hash: string | null;
  archived_at: string | null;
  archived_reason: string | null;
  match_source: string | null;
  review_status: string | null;
  review_resolved_at: string | null;
  extracted_partner_name: string | null;
  match_confidence: number | null;
  match_status: string | null;
  match_method: string | null;
  summary: string | null;
  note: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

export type PartnerDocumentWithPartner = PartnerDocument & {
  partner_name: string;
};

export type PartnerDocumentChunk = {
  id: string;
  partner_id: string;
  document_id: string;
  chunk_text: string;
  page_number: number | null;
  source_label: string | null;
  created_at: string;
};

export type PartnerSearchLog = {
  id: string;
  user_query: string;
  matched_partner_id: string | null;
  intent: string | null;
  answer: string | null;
  created_at: string;
};
