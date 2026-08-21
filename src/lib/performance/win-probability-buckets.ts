import { normalizeWinProbabilityLabel, isExpectedWinOpportunity } from "@/lib/performance/expected-win";
import { parseWinProbabilityValue } from "@/lib/performance/format";

export const WIN_PROBABILITY_BUCKETS = [
  { id: "0", label: "0%" },
  { id: "25", label: "25%" },
  { id: "50u", label: "50%(U)" },
  { id: "50f", label: "50%(F)" },
  { id: "75", label: "75%" },
  { id: "90", label: "90%" },
  { id: "100", label: "100%" }
] as const;

export type WinProbabilityBucketId = (typeof WIN_PROBABILITY_BUCKETS)[number]["id"];

export function winProbabilityBucketId(row: {
  win_probability_label?: string | null;
  win_probability_value?: number | null;
}): WinProbabilityBucketId | null {
  const normalized = normalizeWinProbabilityLabel(row.win_probability_label);
  if (normalized.includes("50%(U)") || /50%U/.test(normalized)) return "50u";
  if (normalized.includes("50%(F)") || /50%F/.test(normalized)) return "50f";
  if (/^0%/.test(normalized) || normalized === "0") return "0";
  if (/^25%/.test(normalized)) return "25";

  const value =
    row.win_probability_value != null && Number.isFinite(row.win_probability_value)
      ? Number(row.win_probability_value)
      : parseWinProbabilityValue(row.win_probability_label);
  if (value === 75) return "75";
  if (value === 90) return "90";
  if (value === 100) return "100";
  return null;
}

export function buildWinProbabilityBucketStats(
  rows: Array<{
    project_code?: string | null;
    product_amount_million?: number | null;
    win_probability_label?: string | null;
    win_probability_value?: number | null;
  }>
): Array<{ label: string; amount_million: number; count: number }> {
  const map = new Map<WinProbabilityBucketId, { amount: number; codes: Set<string> }>();
  for (const bucket of WIN_PROBABILITY_BUCKETS) {
    map.set(bucket.id, { amount: 0, codes: new Set() });
  }

  for (const row of rows) {
    const id = winProbabilityBucketId(row);
    if (!id) continue;
    const entry = map.get(id)!;
    entry.amount += row.product_amount_million ?? 0;
    if (row.project_code) entry.codes.add(row.project_code);
  }

  return WIN_PROBABILITY_BUCKETS.map((bucket) => {
    const entry = map.get(bucket.id)!;
    return {
      label: bucket.label,
      amount_million: Math.round(entry.amount * 1000) / 1000,
      count: entry.codes.size
    };
  });
}

/** Partner AI "50%(F) 이상" = 수주 예상 집합과 동일 (50%(U) 제외) */
export function isExpectedWinOrHigher(row: {
  win_probability_label?: string | null;
  win_probability_value?: number | null;
}): boolean {
  return isExpectedWinOpportunity(row);
}
