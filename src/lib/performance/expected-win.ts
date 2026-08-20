import { isFy26, parseWinProbabilityValue } from "@/lib/performance/format";

/** 수주확도 라벨 정규화: 공백 제거, 전각 괄호 통일 */
export function normalizeWinProbabilityLabel(label: string | null | undefined): string {
  return String(label ?? "")
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .trim()
    .toUpperCase();
}

/**
 * 수주 예상 프로젝트 판별 (본부장 피드백).
 * 포함: 50%(F), 75%, 90%, 100%
 * 제외: 50%(U), 25%, 0%
 *
 * 숫자만으로 50%를 판별하면 50%(U)가 포함되므로 라벨의 F/U를 반드시 본다.
 */
export function isExpectedWinOpportunity(row: {
  win_probability_label?: string | null;
  win_probability_value?: number | null;
}): boolean {
  const normalized = normalizeWinProbabilityLabel(row.win_probability_label);
  if (!normalized) return false;

  if (normalized.includes("50%(U)") || /50%U/.test(normalized)) return false;
  if (/^0%/.test(normalized) || normalized === "0") return false;
  if (/^25%/.test(normalized)) return false;

  if (normalized.includes("50%(F)") || /50%F/.test(normalized)) return true;

  const value =
    row.win_probability_value != null && Number.isFinite(row.win_probability_value)
      ? Number(row.win_probability_value)
      : parseWinProbabilityValue(row.win_probability_label);

  if (value == null) return false;
  return value === 75 || value === 90 || value === 100;
}

export function isExpectedWinPartnerPipeline(row: {
  is_product_revenue?: boolean | null;
  is_partner_deal?: boolean | null;
  expected_win_year?: string | null;
  win_probability_label?: string | null;
  win_probability_value?: number | null;
}): boolean {
  return (
    Boolean(row.is_product_revenue) &&
    Boolean(row.is_partner_deal) &&
    isFy26(row.expected_win_year) &&
    isExpectedWinOpportunity(row)
  );
}
