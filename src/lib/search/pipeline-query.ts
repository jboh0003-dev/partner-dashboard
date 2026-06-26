import { compactSearchQuery } from "@/lib/search/query-normalize";

export function isPipelineQuery(query: string): boolean {
  const compact = compactSearchQuery(query);
  const lower = query.toLowerCase();
  if (/파이프라인/.test(compact)) return true;
  if (/수주예상/.test(compact) && /파트너/.test(compact)) return true;
  if (/신규등록/.test(compact) && /(파이프라인|기회)/.test(compact)) return true;
  if (/파트너매출|매출top|매출순위/.test(compact)) return true;
  if (/파이프라인top|top10/.test(compact) && /파트너/.test(compact)) return true;
  if (/50%|수주확도/.test(lower) && /파트너/.test(lower)) return true;
  return false;
}
