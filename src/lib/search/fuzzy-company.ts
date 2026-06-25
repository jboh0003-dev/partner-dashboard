import { getExactCompanyNameKey, normalizeCompanyName } from "@/lib/partner-match";
import {
  getSpellingVariantKeys,
  lookupDocumentPartnerAlias
} from "@/lib/documents/partner-aliases";
import { PARTNER_NAME_ALIASES } from "@/lib/search/company-terms";

type PartnerLike = {
  id: string;
  company_name: string;
};

export type CompanyMatchStrategy =
  | "exact"
  | "alias"
  | "includes"
  | "fuzzy"
  | "none"
  | "ambiguous"
  | "low_confidence";

export type CompanyResolveResult = {
  partner: PartnerLike | null;
  candidates: Array<PartnerLike & { score: number; confidence: number }>;
  strategy: CompanyMatchStrategy;
  confidence: number;
  queryUsed: string | null;
};

/** 자동 매칭 허용 최소 신뢰도 */
export const PARTNER_MATCH_CONFIDENCE_THRESHOLD = 75;

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) matrix[i]![0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0]![j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

function fuzzyThreshold(length: number): number {
  return Math.max(2, Math.floor(length * 0.35));
}

function scoreToConfidence(score: number): number {
  if (score === 0) return 100;
  if (score === 1) return 96;
  if (score === 2) return 90;
  if (score === 3) return 84;
  if (score >= 10) {
    const distance = score - 10;
    return Math.max(0, 78 - distance * 18);
  }
  return 0;
}

function scoreCompanyMatch(candidate: string, companyName: string): number {
  const trimmedCandidate = candidate.trim();
  const exactKey = getExactCompanyNameKey(companyName);
  const normalizedCandidate = normalizeCompanyName(trimmedCandidate);
  const normalizedCompany = normalizeCompanyName(companyName);

  if (!normalizedCandidate || !normalizedCompany) return Number.POSITIVE_INFINITY;

  const aliasTarget =
    PARTNER_NAME_ALIASES[trimmedCandidate.toLowerCase()] ??
    lookupDocumentPartnerAlias(trimmedCandidate);
  if (aliasTarget && aliasTarget === normalizedCompany) return 1;

  if (exactKey && exactKey === trimmedCandidate.toLowerCase()) return 0;

  for (const variant of getSpellingVariantKeys(normalizedCandidate)) {
    if (variant === normalizedCompany) return 1;
  }

  if (normalizedCandidate === normalizedCompany) return 1;

  if (
    normalizedCompany.includes(normalizedCandidate) &&
    normalizedCandidate.length >= 3
  ) {
    return 2;
  }

  if (
    normalizedCandidate.includes(normalizedCompany) &&
    normalizedCompany.length >= 4
  ) {
    return 3;
  }

  if (normalizedCandidate.length < 4) return Number.POSITIVE_INFINITY;

  const distance = levenshteinDistance(normalizedCandidate, normalizedCompany);
  const threshold = fuzzyThreshold(
    Math.max(normalizedCandidate.length, normalizedCompany.length)
  );
  if (distance <= threshold && distance <= 2) return 10 + distance;

  return Number.POSITIVE_INFINITY;
}

export function resolveCompanyName(
  candidate: string | null | undefined,
  partners: PartnerLike[]
): CompanyResolveResult {
  const query = candidate?.trim();
  if (!query) {
    return {
      partner: null,
      candidates: [],
      strategy: "none",
      confidence: 0,
      queryUsed: null
    };
  }

  const scored = partners
    .map((partner) => {
      const score = scoreCompanyMatch(query, partner.company_name);
      const confidence = Number.isFinite(score) ? scoreToConfidence(score) : 0;
      return { ...partner, score, confidence };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort(
      (a, b) =>
        a.score - b.score ||
        b.confidence - a.confidence ||
        a.company_name.localeCompare(b.company_name, "ko-KR")
    );

  if (scored.length === 0) {
    return {
      partner: null,
      candidates: [],
      strategy: "none",
      confidence: 0,
      queryUsed: query
    };
  }

  const best = scored[0]!;
  const second = scored[1];
  const ambiguous = second && second.score === best.score;

  if (ambiguous) {
    return {
      partner: null,
      candidates: scored.slice(0, 5),
      strategy: "ambiguous",
      confidence: best.confidence,
      queryUsed: query
    };
  }

  let strategy: CompanyMatchStrategy = "fuzzy";
  if (best.score === 0) strategy = "exact";
  else if (best.score === 1) strategy = "alias";
  else if (best.score <= 3) strategy = "includes";
  else strategy = "fuzzy";

  if (best.confidence < PARTNER_MATCH_CONFIDENCE_THRESHOLD) {
    return {
      partner: null,
      candidates: scored.slice(0, 5),
      strategy: "low_confidence",
      confidence: best.confidence,
      queryUsed: query
    };
  }

  return {
    partner: best,
    candidates: scored.slice(0, 5),
    strategy,
    confidence: best.confidence,
    queryUsed: query
  };
}
