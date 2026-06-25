import { normalizeCompanyName } from "@/lib/partner-match";
import { stripNonPartnerTerms } from "@/lib/search/company-terms";

type PartnerLike = {
  id: string;
  company_name: string;
};

/**
 * 질문문에 실제로 등장하는 파트너 회사명만 후보로 추출한다.
 * 짧은 공통 문자열(fragment) 기반 추측 매칭은 하지 않는다.
 */
export function extractCompanyCandidateFromQuery(
  query: string,
  partners: PartnerLike[],
  strippedFallback: string | null
): string | null {
  const sanitizedQuery = stripNonPartnerTerms(query.trim());
  if (!sanitizedQuery) return null;

  const rawLower = sanitizedQuery.toLowerCase();
  const normalizedQuery = normalizeCompanyName(sanitizedQuery) ?? "";

  const matches: Array<{ name: string; score: number }> = [];

  for (const partner of partners) {
    const name = partner.company_name.trim();
    if (!name) continue;

    const normalizedName = normalizeCompanyName(name);
    if (!normalizedName) continue;

    if (rawLower.includes(name.toLowerCase())) {
      matches.push({ name, score: 0 });
      continue;
    }

    if (normalizedQuery.includes(normalizedName) && normalizedName.length >= 3) {
      matches.push({ name, score: 1 });
    }
  }

  if (matches.length > 0) {
    matches.sort((a, b) => a.score - b.score || b.name.length - a.name.length);
    return matches[0]!.name;
  }

  const fallback = stripNonPartnerTerms(strippedFallback?.trim() ?? "");
  if (fallback.length >= 3) return fallback;

  return null;
}
