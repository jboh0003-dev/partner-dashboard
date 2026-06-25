import {
  DOCUMENT_TYPE_LABEL,
  MATCH_STATUS_LABEL,
  type DocumentMatchStatus
} from "@/lib/documents/constants";
import {
  DOCUMENT_TYPE_DEFAULT_FILE_NAME,
  DOCUMENT_TYPE_SHORT_LABEL
} from "@/lib/documents/display-constants";
import { normalizeCompanyName } from "@/lib/partner-match";
import { companyNamesMatchWithVariants } from "@/lib/documents/partner-aliases";

export {
  DOCUMENT_TYPE_SHORT_LABEL,
  DOCUMENT_TYPE_DEFAULT_FILE_NAME
} from "@/lib/documents/display-constants";

const DOCUMENT_TYPE_ALIASES: Record<string, string> = {
  partner_contract: "partner_contract",
  partner_application: "partner_application",
  business_registration: "business_registration",
  company_profile: "company_profile",
  bank_account: "bank_account",
  credit_rating: "credit_rating",
  security_commitment: "security_commitment",
  "보안확약서": "security_commitment",
  "보안 확약서": "security_commitment",
  확약서: "security_commitment",
  other: "other",
  contract: "contract",
  proposal: "proposal",
  report: "report",
  certificate: "certificate",
  brochure: "brochure",
  etc: "etc",
  "파트너 계약서": "partner_contract",
  "파트너계약서": "partner_contract",
  "파트너 계약": "partner_contract",
  계약서: "partner_contract",
  "파트너 신청서": "partner_application",
  "파트너신청서": "partner_application",
  신청서: "partner_application",
  사업자등록증: "business_registration",
  "사업자 등록증": "business_registration",
  회사소개서: "company_profile",
  "회사 소개서": "company_profile",
  "통장/은행계좌": "bank_account",
  "통장사본": "bank_account",
  "은행계좌": "bank_account",
  "은행 계좌": "bank_account",
  통장: "bank_account",
  신용평가서: "credit_rating",
  "신용 평가서": "credit_rating",
  기타: "other"
};

const PREVIEWABLE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp"]);

export type DocumentDisplaySource = {
  document_type: string | null;
  display_name?: string | null;
  file_name?: string | null;
  original_filename?: string | null;
  file_ext?: string | null;
};

export function isLegacyLongDisplayName(
  displayName: string,
  originalFilename?: string | null
): boolean {
  if (displayName.includes(" · ")) return true;
  if (originalFilename && displayName === originalFilename) return true;
  if (/\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|hwp|zip)$/i.test(displayName)) return true;
  return displayName.length > 48;
}

export function buildAutoDisplayName(doc: DocumentDisplaySource): string {
  const key = normalizeDocumentTypeKey(doc.document_type);
  if (key && DOCUMENT_TYPE_DEFAULT_FILE_NAME[key]) {
    return DOCUMENT_TYPE_DEFAULT_FILE_NAME[key]!;
  }

  const original = doc.original_filename?.trim() || doc.file_name?.trim();
  if (original) {
    const withoutExt = original.replace(/\.[^.]+$/, "");
    if (withoutExt.length <= 24) return withoutExt;
  }

  return getDocumentTypeShortLabel(doc.document_type);
}

export function namesAreConsistent(
  extractedName: string | null | undefined,
  partnerCompanyName: string
): boolean {
  if (!extractedName?.trim()) return true;
  return companyNamesMatchWithVariants(extractedName, partnerCompanyName);
}

export function resolveMatchStatus(input: {
  match_status?: string | null;
  review_status?: string | null;
}): DocumentMatchStatus {
  if (input.match_status === "matched") return "matched";
  if (input.match_status === "needs_review") return "needs_review";
  if (input.match_status === "unmatched") return "unmatched";
  if (input.review_status === "needs_review") return "needs_review";
  if (input.review_status === "skipped") return "unmatched";
  return "matched";
}

export function getMatchStatusLabel(status: DocumentMatchStatus): string {
  return MATCH_STATUS_LABEL[status];
}

export function hasPartnerNameMismatch(input: {
  partner_name: string;
  extracted_partner_name?: string | null;
  match_status?: string | null;
}): boolean {
  if (input.match_status === "needs_review") return true;
  if (!input.extracted_partner_name?.trim()) return false;
  return !namesAreConsistent(input.extracted_partner_name, input.partner_name);
}

export function normalizeDocumentTypeKey(documentType: string | null | undefined): string | null {
  if (!documentType?.trim()) return null;

  const trimmed = documentType.trim();
  const alias = DOCUMENT_TYPE_ALIASES[trimmed];
  if (alias) return alias;

  const lower = trimmed.toLowerCase();
  const aliasLower = DOCUMENT_TYPE_ALIASES[lower];
  if (aliasLower) return aliasLower;

  for (const [key, label] of Object.entries(DOCUMENT_TYPE_LABEL)) {
    if (label === trimmed) return key;
  }

  if (trimmed.includes("계약")) return "partner_contract";
  if (trimmed.includes("신청")) return "partner_application";
  if (trimmed.includes("사업자")) return "business_registration";
  if (trimmed.includes("통장") || trimmed.includes("계좌")) return "bank_account";
  if (trimmed.includes("신용")) return "credit_rating";
  if (trimmed.includes("소개")) return "company_profile";

  return trimmed;
}

export function getDocumentTypeShortLabel(documentType: string | null | undefined): string {
  const key = normalizeDocumentTypeKey(documentType);
  if (!key) return "-";
  return DOCUMENT_TYPE_SHORT_LABEL[key] ?? DOCUMENT_TYPE_LABEL[key] ?? key;
}

export function getDocumentDisplayFileName(doc: DocumentDisplaySource): string {
  const customName = doc.display_name?.trim();
  if (customName && !isLegacyLongDisplayName(customName, doc.original_filename ?? doc.file_name)) {
    return customName;
  }

  return buildAutoDisplayName(doc);
}

export function getDocumentDownloadFileName(doc: DocumentDisplaySource): string {
  return (
    doc.original_filename?.trim() ||
    doc.file_name?.trim() ||
    `${getDocumentDisplayFileName(doc)}.${resolveDocumentExtension(doc)}`
  );
}

export function resolveDocumentExtension(doc: DocumentDisplaySource): string {
  const fromField = doc.file_ext?.trim().replace(/^\./, "").toLowerCase();
  if (fromField) return fromField;

  const filename = doc.original_filename ?? doc.file_name ?? "";
  const match = filename.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "bin";
}

export function isPreviewableDocument(doc: DocumentDisplaySource): boolean {
  return PREVIEWABLE_EXTENSIONS.has(resolveDocumentExtension(doc));
}

export function getDocumentContentType(doc: DocumentDisplaySource): string {
  const ext = resolveDocumentExtension(doc);
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "xls":
      return "application/vnd.ms-excel";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default:
      return "application/octet-stream";
  }
}
