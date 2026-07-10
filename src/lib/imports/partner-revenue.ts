import type { ParsedRevenueRow } from "@/lib/excel/parse-partner-performance";
import {
  matchPerformancePartnerName,
  toImportMatchStatus,
  type PartnerAliasRow,
  type PerformancePartnerRow
} from "@/lib/partners/performance-match";

export type MatchedRevenueRow = ParsedRevenueRow & {
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  match_status: "matched" | "review";
  match_reason: string | null;
  raw_partner_name: string;
};

export function applyPartnerMatch(
  row: ParsedRevenueRow,
  partners: PerformancePartnerRow[],
  aliases: PartnerAliasRow[] = []
): MatchedRevenueRow {
  const match = matchPerformancePartnerName(row.partner_name, partners, { aliases });
  return {
    ...row,
    matched_partner_id: match.partner?.id ?? null,
    matched_partner_name: match.partner?.company_name ?? null,
    match_status: toImportMatchStatus(match.match_status),
    match_reason: match.match_reason,
    raw_partner_name: row.partner_name
  };
}
