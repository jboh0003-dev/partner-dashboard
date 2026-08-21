import { compactSearchQuery } from "@/lib/search/query-normalize";
import { queryHasExpectedWinHint, queryHasPipelineHint } from "@/lib/search/entity-detect";

export function isPipelineQuery(query: string): boolean {
  if (queryHasPipelineHint(query) || queryHasExpectedWinHint(query)) return true;
  const compact = compactSearchQuery(query);
  const lower = query.toLowerCase();
  if (/(정책|기준|절차|deal\s*registration|영업기회등록)/.test(lower.replace(/\s+/g, "")) && !/파이프라인|수주예상|전체영업기회/.test(compact)) {
    return false;
  }
  if (/파트너매출|매출top|매출순위/.test(compact)) return true;
  if (/파이프라인top|top10/.test(compact) && /파트너/.test(compact)) return true;
  if (/50%|수주확도/.test(lower) && /(파트너|프로젝트|파이프라인|영업기회)/.test(lower)) return true;
  return false;
}
