import type { ApplicationStatus } from "@/lib/partner-applications/types";
import type { PreReviewResult } from "@/lib/partner-applications/pre-review";

export type ApplicationDisplayStatus =
  | "draft"
  | "received"
  | "ai_reviewing"
  | "needs_revision"
  | "admin_review"
  | "approved"
  | "rejected"
  | "contracted";

export const APPLICATION_DISPLAY_STATUS_LABEL: Record<ApplicationDisplayStatus, string> = {
  draft: "작성중",
  received: "접수",
  ai_reviewing: "AI 검토 중",
  needs_revision: "보완 필요",
  admin_review: "관리자 검토 대기",
  approved: "승인",
  rejected: "반려",
  contracted: "계약"
};

export const DB_STATUS_FILTER_LABEL: Record<ApplicationStatus, string> = {
  draft: "작성중",
  submitted: "접수",
  under_review: "관리자 검토 대기",
  revision_requested: "보완 필요",
  approved: "승인",
  rejected: "반려",
  contracted: "계약"
};

export function resolveApplicationDisplayStatus(input: {
  dbStatus: string;
  preReview?: Pick<PreReviewResult, "status" | "overall"> | null;
}): ApplicationDisplayStatus {
  const status = input.dbStatus;
  if (status === "draft") return "draft";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "contracted") return "contracted";
  if (status === "revision_requested") return "needs_revision";

  const review = input.preReview;
  if (review?.status === "running") return "ai_reviewing";

  if (status === "submitted" || status === "under_review") {
    if (!review) return status === "submitted" ? "received" : "admin_review";
    if (review.status === "failed") return "admin_review";
    if (review.overall === "needs_fix") return "needs_revision";
    return "admin_review";
  }

  return "received";
}

export function displayStatusTone(
  status: ApplicationDisplayStatus
): "neutral" | "primary" | "success" | "warning" | "danger" {
  if (status === "approved" || status === "contracted") return "success";
  if (status === "rejected") return "danger";
  if (status === "needs_revision") return "warning";
  if (status === "draft") return "neutral";
  return "primary";
}
