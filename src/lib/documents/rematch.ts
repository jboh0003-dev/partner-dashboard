import { hasPartnerNameMismatch, resolveMatchStatus } from "@/lib/documents/display";
import { PARTNER_DOCUMENT_TAB_TYPE_LABEL } from "@/lib/documents/partner-tab-display";
import {
  formatReferenceNote,
  isYearLenientDocumentType,
  isYearRelatedSummary,
  shouldIgnoreNameMismatchForReview
} from "@/lib/documents/review-rules";
import { isManuallyConfirmedReview } from "@/lib/documents/review-status";

/** 문서 재매칭 모달 문서 구분 옵션 */
export const REMATCH_DOCUMENT_TYPE_OPTIONS = [
  { value: "partner_application", label: "파트너 신청서" },
  { value: "company_profile", label: "회사소개서" },
  { value: "business_registration", label: "사업자등록증" },
  { value: "bank_account", label: "통장사본" },
  { value: "credit_rating", label: "신용평가서" },
  { value: "partner_contract", label: "파트너 계약서" },
  { value: "security_commitment", label: "보안확약서" },
  { value: "tech_profile", label: "기술인력 프로필" },
  { value: "other", label: "기타 문서" }
] as const;

export type DocumentRematchSource = {
  partner_name: string;
  extracted_partner_name?: string | null;
  document_type: string | null;
  original_filename?: string | null;
  match_status?: string | null;
  review_status?: string | null;
  duplicate_reason?: string | null;
  summary?: string | null;
};

export function getDocumentReviewReason(doc: DocumentRematchSource): string {
  const reasons: string[] = [];
  const status = resolveMatchStatus({
    match_status: doc.match_status,
    review_status: doc.review_status,
    document_type: doc.document_type,
    partner_name: doc.partner_name,
    extracted_partner_name: doc.extracted_partner_name,
    summary: doc.summary
  });

  if (isManuallyConfirmedReview(doc.review_status)) {
    return "수동 확인 완료";
  }

  if (doc.duplicate_reason === "near_duplicate_candidate") {
    reasons.push("유사 중복 문서 후보");
  }

  const nameMismatch =
    hasPartnerNameMismatch({
      partner_name: doc.partner_name,
      extracted_partner_name: doc.extracted_partner_name,
      match_status: doc.match_status,
      review_status: doc.review_status
    }) && doc.extracted_partner_name?.trim();

  if (
    nameMismatch &&
    !shouldIgnoreNameMismatchForReview({
      document_type: doc.document_type,
      extracted_partner_name: doc.extracted_partner_name,
      summary: doc.summary
    })
  ) {
    reasons.push(`파트너사명 불일치 (파일명 추출: ${doc.extracted_partner_name!.trim()})`);
  }

  if (!doc.document_type?.trim()) {
    reasons.push("문서 구분 미지정");
  } else if (!PARTNER_DOCUMENT_TAB_TYPE_LABEL[doc.document_type]) {
    reasons.push("문서 구분 확인 필요");
  }

  if (status === "needs_review" && reasons.length === 0) {
    reasons.push("매칭 결과 확인 필요");
  }

  const summary = doc.summary?.trim();
  if (summary && summary.length <= 120) {
    if (doc.document_type === "credit_rating" && isYearRelatedSummary(summary)) {
      reasons.push(formatReferenceNote(summary));
    } else if (!isYearLenientDocumentType(doc.document_type) || !isYearRelatedSummary(summary)) {
      reasons.push(summary);
    } else {
      reasons.push(formatReferenceNote(summary));
    }
  }

  return reasons.length > 0 ? reasons.join(" · ") : "-";
}
