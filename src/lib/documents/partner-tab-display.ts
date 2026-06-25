import { normalizeDocumentTypeKey } from "@/lib/documents/display";

/** 파트너 상세 > 문서 탭 표시 순서 */
export const PARTNER_DOCUMENT_TAB_ORDER = [
  "partner_application",
  "company_profile",
  "business_registration",
  "bank_account",
  "credit_rating",
  "partner_contract",
  "other_generic",
  "security_commitment",
  "tech_profile"
] as const;

/** 파트너 상세 > 문서 탭 문서 구분 라벨 */
export const PARTNER_DOCUMENT_TAB_TYPE_LABEL: Record<string, string> = {
  partner_application: "파트너 신청서",
  partner_application_group: "파트너 신청서",
  company_profile: "회사소개서",
  business_registration: "사업자등록증",
  bank_account: "통장사본",
  credit_rating: "신용평가서",
  partner_contract: "파트너 계약서",
  partner_contract_group: "파트너 계약서",
  security_commitment: "보안확약서",
  other: "기타 문서",
  other_generic: "기타 문서",
  tech_profile: "기술인력 프로필",
  contract: "파트너 계약서",
  proposal: "제안서",
  report: "보고서",
  certificate: "인증/자격",
  brochure: "브로셔",
  etc: "기타 문서"
};

export function isTechnicalProfileDocument(doc: {
  document_type: string | null;
  original_filename?: string | null;
  display_name?: string | null;
  file_name?: string | null;
}): boolean {
  const haystack = `${doc.original_filename ?? ""} ${doc.display_name ?? ""} ${doc.file_name ?? ""}`.toLowerCase();
  return (
    /기술\s*인력|인력\s*프로필|technical\s*profile|tech\s*profile/.test(haystack) ||
    (/profile|프로필|resume|\bcv\b|이력\s*서/.test(haystack) &&
      (doc.document_type === "other" || doc.document_type === "etc"))
  );
}

export function getPartnerDocumentTabSortKey(doc: {
  document_type: string | null;
  original_filename?: string | null;
  display_name?: string | null;
  file_name?: string | null;
}): (typeof PARTNER_DOCUMENT_TAB_ORDER)[number] {
  if (isTechnicalProfileDocument(doc)) return "tech_profile";

  const type = normalizeDocumentTypeKey(doc.document_type) ?? "other";
  if (type === "security_commitment") return "security_commitment";
  if (type === "other" || type === "etc" || type === "proposal" || type === "report") {
    return "other_generic";
  }
  if (type in PARTNER_DOCUMENT_TAB_ORDER) {
    return type as (typeof PARTNER_DOCUMENT_TAB_ORDER)[number];
  }
  return "other_generic";
}

export function comparePartnerDocumentsForTab<T extends {
  document_type: string | null;
  original_filename?: string | null;
  display_name?: string | null;
  file_name?: string | null;
  created_at: string;
}>(left: T, right: T): number {
  const leftIndex = PARTNER_DOCUMENT_TAB_ORDER.indexOf(getPartnerDocumentTabSortKey(left));
  const rightIndex = PARTNER_DOCUMENT_TAB_ORDER.indexOf(getPartnerDocumentTabSortKey(right));
  if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

export function getPartnerDocumentTabTypeLabel(doc: {
  document_type: string | null;
  original_filename?: string | null;
  display_name?: string | null;
  file_name?: string | null;
}): string {
  const sortKey = getPartnerDocumentTabSortKey(doc);
  if (PARTNER_DOCUMENT_TAB_TYPE_LABEL[sortKey]) {
    return PARTNER_DOCUMENT_TAB_TYPE_LABEL[sortKey];
  }
  const type = normalizeDocumentTypeKey(doc.document_type);
  if (type && PARTNER_DOCUMENT_TAB_TYPE_LABEL[type]) {
    return PARTNER_DOCUMENT_TAB_TYPE_LABEL[type];
  }
  return "기타 문서";
}
