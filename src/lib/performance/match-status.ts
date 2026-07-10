import type { PartnerPipelineOpportunity } from "@/types/partner-performance";

/** 수동 검토가 필요한 match_status 값 */
export const PERFORMANCE_REVIEW_STATUSES = new Set([
  "unmatched",
  "unknown_partner",
  "review_needed",
  "review" // 이전 import 호환
]);

export function needsPerformanceReview(
  row: Pick<PartnerPipelineOpportunity, "match_status" | "matched_partner_id">
): boolean {
  if (row.match_status === "not_partner" || row.match_status === "matched" || row.match_status === "alias_matched") {
    return false;
  }
  if (row.match_status && PERFORMANCE_REVIEW_STATUSES.has(row.match_status)) {
    return true;
  }
  return !row.matched_partner_id;
}

export function canManualMatchPerformance(
  row: Pick<PartnerPipelineOpportunity, "match_status" | "matched_partner_id">
): boolean {
  if (row.match_status === "not_partner" || row.match_status === "matched" || row.match_status === "alias_matched") {
    return false;
  }
  if (!row.match_status) return !row.matched_partner_id;
  return PERFORMANCE_REVIEW_STATUSES.has(row.match_status);
}

export function performanceMatchStatusLabel(status: string | null): string {
  switch (status) {
    case "matched":
      return "매칭됨";
    case "alias_matched":
      return "별칭 매칭";
    case "unmatched":
      return "미매칭";
    case "unknown_partner":
      return "파트너 미기재";
    case "not_partner":
      return "파트너 아님";
    case "review_needed":
    case "review":
      return "검토 필요";
    default:
      return status ?? "-";
  }
}
