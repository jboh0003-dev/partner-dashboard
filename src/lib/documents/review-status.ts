import type { DocumentMatchStatus, DocumentReviewStatus } from "@/lib/documents/constants";
import { companyNamesMatchWithVariants } from "@/lib/documents/partner-aliases";
import {
  shouldFlagContractDateMismatch,
  shouldIgnoreNameMismatchForReview
} from "@/lib/documents/review-rules";

export type DocumentDisplayStatus =
  | "normal"
  | "needs_review"
  | "manually_confirmed"
  | "duplicate_hidden"
  | "excluded"
  | "old_version"
  | "unmatched";

export type DocumentStatusSource = {
  match_status?: string | null;
  review_status?: string | null;
  is_duplicate?: boolean | null;
  is_active?: boolean | null;
  duplicate_reason?: string | null;
  archived_reason?: string | null;
  document_type?: string | null;
  partner_name?: string;
  extracted_partner_name?: string | null;
  summary?: string | null;
  contract_date?: string | null;
  period_year?: number | null;
};

export function isManuallyConfirmedReview(
  reviewStatus: string | null | undefined
): reviewStatus is "manually_confirmed" {
  return reviewStatus === "manually_confirmed";
}

export function isExcludedReview(reviewStatus: string | null | undefined): boolean {
  return reviewStatus === "excluded" || reviewStatus === "skipped";
}

export function shouldSkipReinspect(reviewStatus: string | null | undefined): boolean {
  return isManuallyConfirmedReview(reviewStatus) || reviewStatus === "excluded";
}

export function resolveDisplayStatus(doc: DocumentStatusSource): DocumentDisplayStatus {
  if (doc.is_duplicate) return "duplicate_hidden";
  if (isExcludedReview(doc.review_status)) return "excluded";
  if (doc.archived_reason === "old_version" || doc.duplicate_reason === "new_version") {
    return "old_version";
  }
  if (isManuallyConfirmedReview(doc.review_status)) return "manually_confirmed";

  const effective = resolveEffectiveMatchStatus(doc);
  if (effective === "unmatched") return "unmatched";
  if (effective === "needs_review") return "needs_review";
  return "normal";
}

export function resolveEffectiveMatchStatus(doc: DocumentStatusSource): DocumentMatchStatus {
  if (isManuallyConfirmedReview(doc.review_status) || isExcludedReview(doc.review_status)) {
    return "matched";
  }

  if (doc.match_status === "unmatched" || doc.review_status === "skipped") {
    return "unmatched";
  }

  if (doc.match_status === "needs_review" || doc.review_status === "needs_review") {
    return "needs_review";
  }

  if (shouldClientElevateToNeedsReview(doc)) {
    return "needs_review";
  }

  return "matched";
}

export function shouldClientElevateToNeedsReview(doc: DocumentStatusSource): boolean {
  if (isManuallyConfirmedReview(doc.review_status) || isExcludedReview(doc.review_status)) {
    return false;
  }

  if (shouldFlagContractDateMismatch(doc)) {
    return true;
  }

  if (doc.partner_name && hasExtractedNameMismatch(doc)) {
    if (
      shouldIgnoreNameMismatchForReview({
        document_type: doc.document_type,
        extracted_partner_name: doc.extracted_partner_name,
        summary: doc.summary
      })
    ) {
      return false;
    }
    return true;
  }

  return false;
}

function hasExtractedNameMismatch(doc: DocumentStatusSource): boolean {
  if (isManuallyConfirmedReview(doc.review_status) || isExcludedReview(doc.review_status)) {
    return false;
  }
  if (doc.match_status === "needs_review" || doc.review_status === "needs_review") {
    return Boolean(doc.extracted_partner_name?.trim());
  }
  if (!doc.extracted_partner_name?.trim() || !doc.partner_name) return false;
  return !companyNamesMatchWithVariants(doc.extracted_partner_name, doc.partner_name);
}

export function shouldAppearInNeedsReviewFilter(doc: DocumentStatusSource): boolean {
  if (isManuallyConfirmedReview(doc.review_status) || isExcludedReview(doc.review_status)) {
    return false;
  }
  return resolveEffectiveMatchStatus(doc) === "needs_review";
}

export function countAsActiveNeedsReview(doc: DocumentStatusSource): boolean {
  if (doc.is_duplicate || doc.is_active === false) return false;
  return shouldAppearInNeedsReviewFilter(doc);
}

export const DISPLAY_STATUS_LABEL: Record<DocumentDisplayStatus, string> = {
  normal: "정상",
  needs_review: "확인 필요",
  manually_confirmed: "정상",
  duplicate_hidden: "중복 숨김",
  excluded: "제외",
  old_version: "구버전",
  unmatched: "미연결"
};

export function toPersistedReviewStatus(
  action: "confirm" | "exclude"
): DocumentReviewStatus {
  return action === "confirm" ? "manually_confirmed" : "excluded";
}
