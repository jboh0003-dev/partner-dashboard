export const DOCUMENT_TYPES = [
  "partner_contract",
  "partner_application",
  "business_registration",
  "company_profile",
  "bank_account",
  "credit_rating",
  "security_commitment",
  "other"
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  partner_contract: "파트너 계약서",
  partner_application: "파트너 신청서",
  business_registration: "사업자등록증",
  company_profile: "회사소개서",
  bank_account: "통장사본",
  credit_rating: "신용평가서",
  security_commitment: "보안확약서",
  other: "기타",
  contract: "계약서",
  proposal: "제안서",
  report: "보고서",
  certificate: "인증/자격",
  brochure: "브로셔",
  etc: "기타"
};

export const PARTNER_DOCUMENTS_BUCKET = "partner-documents";

export const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "xlsx",
  "xls",
  "ppt",
  "pptx",
  "doc",
  "docx",
  "png",
  "jpg",
  "jpeg"
]);

export const MAX_DOCUMENT_FILE_SIZE = 50 * 1024 * 1024;

export type DocumentMatchSource = "folder" | "filename" | "partner_no" | "fuzzy" | "manual";

export type DocumentReviewStatus =
  | "auto_matched"
  | "needs_review"
  | "skipped"
  | "manually_confirmed"
  | "excluded";

export type DocumentMatchStatus = "matched" | "needs_review" | "unmatched";

export type DocumentMatchMethod =
  | "exact"
  | "alias"
  | "includes"
  | "fuzzy"
  | "folder"
  | "manual";

export const MATCH_STATUS_LABEL: Record<DocumentMatchStatus, string> = {
  matched: "정상",
  needs_review: "확인 필요",
  unmatched: "미연결"
};

export const MATCH_METHOD_LABEL: Record<DocumentMatchMethod, string> = {
  exact: "정확일치",
  alias: "별칭",
  includes: "포함검색",
  fuzzy: "유사검색",
  folder: "폴더명",
  manual: "수동확인"
};

export const MATCH_SOURCE_LABEL: Record<DocumentMatchSource, string> = {
  folder: "폴더명",
  filename: "파일명",
  partner_no: "파트너번호",
  fuzzy: "유사매칭",
  manual: "수동선택"
};

export const REVIEW_STATUS_LABEL: Record<DocumentReviewStatus, string> = {
  auto_matched: "자동매칭",
  needs_review: "확인필요",
  skipped: "스킵",
  manually_confirmed: "수동확인",
  excluded: "제외"
};

export function isAllowedDocumentExtension(ext: string): boolean {
  const normalized = ext.trim().replace(/^\./, "").toLowerCase();
  return ALLOWED_DOCUMENT_EXTENSIONS.has(normalized);
}
