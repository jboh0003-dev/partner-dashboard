import type { DocumentType } from "@/lib/documents/constants";

/** 연도 불일치만으로 확인 필요를 올리지 않는 문서 유형 */
const YEAR_LENIENT_TYPES = new Set<string>([
  "partner_application",
  "business_registration",
  "bank_account",
  "company_profile",
  "credit_rating"
]);

/** 계약일·문서일자 불일치 확인이 의미 있는 유형 */
const CONTRACT_DATE_STRICT_TYPES = new Set<string>(["partner_contract"]);

export function isYearLenientDocumentType(documentType: string | null | undefined): boolean {
  if (!documentType?.trim()) return false;
  return YEAR_LENIENT_TYPES.has(documentType.trim());
}

export function isContractDateStrictDocumentType(documentType: string | null | undefined): boolean {
  if (!documentType?.trim()) return false;
  return CONTRACT_DATE_STRICT_TYPES.has(documentType.trim());
}

export function isYearOnlyExtractedName(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return /^(20\d{2})\s*년?$/.test(value.trim());
}

export function isYearRelatedSummary(summary: string | null | undefined): boolean {
  if (!summary?.trim()) return false;
  const text = summary.trim();
  return (
    /파일명\s*추출\s*:\s*(20\d{2})/.test(text) ||
    /(20\d{2})\s*년/.test(text) ||
    /연도\s*(불일치|차이|오래)/.test(text)
  );
}

export function shouldIgnoreNameMismatchForReview(input: {
  document_type: string | null | undefined;
  extracted_partner_name?: string | null;
  summary?: string | null;
}): boolean {
  const docType = input.document_type;
  if (isYearLenientDocumentType(docType)) {
    if (isYearOnlyExtractedName(input.extracted_partner_name)) return true;
    if (docType === "credit_rating" && isYearRelatedSummary(input.summary)) return true;
  }
  return false;
}

export function shouldFlagContractDateMismatch(input: {
  document_type?: string | null;
  contract_date?: string | null;
  period_year?: number | null;
  extracted_partner_name?: string | null;
}): boolean {
  if (!isContractDateStrictDocumentType(input.document_type)) return false;
  if (!input.contract_date || !input.period_year) return false;

  const contractYear = new Date(input.contract_date).getFullYear();
  if (!Number.isFinite(contractYear) || contractYear !== input.period_year) {
    return true;
  }

  if (
    input.extracted_partner_name?.trim() &&
    isYearOnlyExtractedName(input.extracted_partner_name) &&
    input.period_year !== contractYear
  ) {
    return true;
  }

  return false;
}

export function formatReferenceNote(summary: string): string {
  const trimmed = summary.trim();
  if (/^참고\s*:/.test(trimmed)) return trimmed;
  return `참고: ${trimmed}`;
}
