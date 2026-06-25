/** 파트너사명으로 매칭하면 안 되는 자사/일반 용어 */
export const NON_PARTNER_TERMS = [
  "오케스트로",
  "okestro",
  "okestro cloud",
  "클라우드",
  "장비규격",
  "장비 규격",
  "파트너 정보",
  "파트너사",
  "정기교육",
  "교육 현황",
  "참석 현황"
];

/** 별칭 → partners.company_name 정규화 키 (문서 별칭 그룹과 동기화) */
import { buildDocumentPartnerAliasMap } from "@/lib/documents/partner-aliases";

export const PARTNER_NAME_ALIASES: Record<string, string> = buildDocumentPartnerAliasMap();

export function stripNonPartnerTerms(text: string): string {
  let result = text;
  for (const term of [...NON_PARTNER_TERMS].sort((a, b) => b.length - a.length)) {
    result = result.replace(new RegExp(term, "gi"), " ");
  }
  return result.replace(/\s+/g, " ").trim();
}
