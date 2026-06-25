import {
  MANAGEMENT_PRIORITY_LABEL,
  MANAGEMENT_PRIORITY_RANK,
  type ManagementPriorityKey
} from "@/lib/constants";
import type { Partner } from "@/types/partner";

export type ManagementPriority = {
  key: ManagementPriorityKey;
  rank: number;
  label: string;
};

export function calcManagementPriority(
  partner: Pick<
    Partner,
    "has_sales_opportunity" | "has_training" | "theory_only" | "contract_start_date"
  >,
  now: Date = new Date()
): ManagementPriority {
  const opportunity = partner.has_sales_opportunity === true;
  const trained = partner.has_training === true;
  const theoryOnly = partner.theory_only === true;

  if (opportunity && !trained) {
    return toPriority("p1_opportunity_no_training");
  }
  if (opportunity && theoryOnly) {
    return toPriority("p2_opportunity_theory_only");
  }
  if (isWithinRecentMonths(partner.contract_start_date, 3, now) && !trained) {
    return toPriority("p3_recent_contract_no_training");
  }
  if (!trained) {
    return toPriority("p4_no_training_history");
  }
  return toPriority("p5_general");
}

function toPriority(key: ManagementPriorityKey): ManagementPriority {
  return {
    key,
    rank: MANAGEMENT_PRIORITY_RANK[key],
    label: MANAGEMENT_PRIORITY_LABEL[key]
  };
}

function isWithinRecentMonths(
  isoDate: string | null | undefined,
  months: number,
  now: Date
): boolean {
  if (!isoDate) return false;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);
  return d >= cutoff && d <= now;
}

export const PRIORITY_BADGE_STYLE: Record<ManagementPriorityKey, string> = {
  p1_opportunity_no_training: "bg-rose-50 text-rose-700 border-rose-200",
  p2_opportunity_theory_only: "bg-orange-50 text-orange-700 border-orange-200",
  p3_recent_contract_no_training: "bg-amber-50 text-amber-700 border-amber-200",
  p4_no_training_history: "bg-slate-100 text-slate-700 border-slate-200",
  p5_general: "bg-emerald-50 text-emerald-700 border-emerald-200"
};
