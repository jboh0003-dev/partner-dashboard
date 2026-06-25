import { isDocumentTypeConfident } from "@/lib/documents/classify";
import { resolveSaveAction, type PartnerDocumentAnalysisItem } from "@/lib/imports/partner-documents";

export type UploadReviewFilter =
  | "all"
  | "saveable"
  | "needs_review"
  | "matched"
  | "no_partner";

export type UploadReviewStats = {
  total: number;
  saveable: number;
  needsReview: number;
  noPartner: number;
  docTypeUncertain: number;
};

export function computeUploadReviewStats(items: PartnerDocumentAnalysisItem[]): UploadReviewStats {
  let saveable = 0;
  let needsReview = 0;
  let noPartner = 0;
  let docTypeUncertain = 0;

  for (const item of items) {
    if (item.review_status === "skipped") continue;
    if (!item.matched_partner_id) noPartner += 1;
    if (!isDocumentTypeConfident(item.original_filename, item.document_type)) {
      docTypeUncertain += 1;
    }
    if (resolveSaveAction(item)) saveable += 1;
    if (item.action === "review" || item.match_status === "needs_review") needsReview += 1;
  }

  return {
    total: items.filter((item) => item.review_status !== "skipped").length,
    saveable,
    needsReview,
    noPartner,
    docTypeUncertain
  };
}

export function filterUploadReviewItems(
  items: PartnerDocumentAnalysisItem[],
  input: {
    statusFilter: UploadReviewFilter;
    needsReviewOnly: boolean;
    saveableOnly: boolean;
    query: string;
  }
): PartnerDocumentAnalysisItem[] {
  const q = input.query.trim().toLowerCase();

  return items.filter((item) => {
    if (input.needsReviewOnly && item.review_status !== "skipped") {
      const needsReview = item.action === "review" || item.match_status === "needs_review";
      if (!needsReview) return false;
    }

    if (input.saveableOnly && !resolveSaveAction(item)) return false;

    if (input.statusFilter === "saveable" && !resolveSaveAction(item)) return false;
    if (
      input.statusFilter === "needs_review" &&
      !(item.action === "review" || item.match_status === "needs_review")
    ) {
      return false;
    }
    if (input.statusFilter === "matched" && item.match_status !== "matched") return false;
    if (input.statusFilter === "no_partner" && item.matched_partner_id) return false;

    if (!q) return true;

    const haystack = [
      item.source_folder_name,
      item.source_folder,
      item.original_filename,
      item.matched_partner_name,
      item.suggested_partner_name,
      item.partner_name_raw,
      item.reason
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function getUploadRowStatusLabel(item: PartnerDocumentAnalysisItem): string {
  if (item.review_status === "skipped") return "스킵";
  if (item.reason.includes("파트너 DB에 등록되지 않은")) return "파트너 미등록";
  if (!item.matched_partner_id) {
    if (item.match_status === "unmatched") return "파트너 미등록";
    return "파트너 미선택";
  }
  if (!isDocumentTypeConfident(item.original_filename, item.document_type)) {
    return "문서유형 확인 필요";
  }
  if (item.partner_edit_source === "folder_bulk") return "폴더 일괄 적용됨";
  if (item.partner_edit_source === "manual") return "수동 수정됨";
  if (item.partner_edit_source === "suggested") return "추천 적용됨";
  if (resolveSaveAction(item)) return "저장 예정";
  if (item.match_status === "matched") return "매칭 완료";
  return "확인 필요";
}

export function getUploadRowStatusTone(
  item: PartnerDocumentAnalysisItem
): "slate" | "amber" | "emerald" | "rose" | "blue" {
  const label = getUploadRowStatusLabel(item);
  if (label === "저장 예정" || label === "매칭 완료") return "emerald";
  if (label === "파트너 미등록" || label === "파트너 미선택" || label === "확인 필요") return "rose";
  if (label === "문서유형 확인 필요") return "amber";
  if (label.includes("적용")) return "blue";
  return "slate";
}

export const UPLOAD_DOCUMENT_TYPES = [
  "partner_contract",
  "partner_application",
  "business_registration",
  "bank_account",
  "company_profile",
  "credit_rating",
  "security_commitment",
  "other"
] as const;

export const UPLOAD_DOCUMENT_TYPE_LABEL: Record<(typeof UPLOAD_DOCUMENT_TYPES)[number], string> = {
  partner_contract: "계약서",
  partner_application: "신청서",
  business_registration: "사업자등록증",
  bank_account: "통장사본",
  company_profile: "회사소개서",
  credit_rating: "신용평가서",
  security_commitment: "보안확약서",
  other: "기타"
};
