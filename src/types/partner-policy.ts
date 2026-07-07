export type PartnerPolicyDocument = {
  id: string;
  policy_title: string;
  version_label: string;
  effective_date: string;
  source_file_name: string;
  storage_path: string;
  file_type: string;
  file_size: number | null;
  description: string | null;
  change_memo: string | null;
  is_current: boolean;
  status: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerPolicyChunk = {
  id: string;
  policy_document_id: string;
  section_title: string | null;
  category: string | null;
  slide_number: number | null;
  page_number: number | null;
  content: string;
  keywords: string[] | null;
  raw_json: Record<string, unknown> | null;
  is_active: boolean;
  parse_status: string;
  created_at: string;
};

export type PolicyAnalyzeSlide = {
  slide_number: number;
  title: string;
  body_preview: string;
  category: string;
  keywords: string[];
  chunk_count: number;
};

export type PolicyParseValidation = {
  total_slides: number;
  text_extracted_slides: number;
  total_chunks: number;
  xml_tag_chunks: number;
  categorized_slides: number;
  can_save: boolean;
  block_reason: string | null;
};
