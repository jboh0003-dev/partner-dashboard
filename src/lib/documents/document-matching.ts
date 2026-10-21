import type { DocumentMatchMethod, DocumentMatchStatus } from "@/lib/documents/constants";
import {
  shouldFlagContractDateMismatch,
  shouldIgnoreNameMismatchForReview
} from "@/lib/documents/review-rules";
import { matchReasonForStrategy } from "@/lib/documents/partner-aliases";
import {
  PARTNER_MATCH_CONFIDENCE_THRESHOLD,
  resolveCompanyName,
  type CompanyMatchStrategy,
  type CompanyResolveResult
} from "@/lib/search/fuzzy-company";

export type DocumentPartnerRow = {
  id: string;
  company_name: string;
  external_no: string | null;
};

export type DocumentMatchResult = {
  partner: DocumentPartnerRow | null;
  match_status: DocumentMatchStatus;
  match_method: DocumentMatchMethod | null;
  match_confidence: number;
  reason: string;
  save_enabled: boolean;
  candidates: DocumentPartnerRow[];
};

type CandidateMatch = {
  partner: DocumentPartnerRow;
  method: DocumentMatchMethod | null;
  confidence: number;
  strategy: CompanyMatchStrategy;
  queryUsed: string;
};

const REASON = {
  alias: "별칭 기준으로 매칭되었습니다.",
  unregistered: "파트너 DB에 등록되지 않은 회사입니다.",
  sourceConflict: "폴더명과 파일명 기준 매칭 결과가 다릅니다.",
  manualRequired: "파트너를 직접 선택해 주세요.",
  ambiguous: "복수의 파트너 후보가 있어 확인이 필요합니다.",
  fuzzy: "유사 파트너명이 확인되었습니다. 파트너를 직접 선택해 주세요.",
  genericFolder: "월별/공통 폴더로 판단되어 파일명 기준으로 파트너를 확인해야 합니다."
} as const;

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function strategyToMethod(strategy: CompanyMatchStrategy): DocumentMatchMethod | null {
  switch (strategy) {
    case "exact":
      return "exact";
    case "alias":
      return "alias";
    case "includes":
      return "includes";
    case "fuzzy":
      return "fuzzy";
    default:
      return null;
  }
}

function mapCandidates(
  candidates: Array<{ id: string; company_name: string }>,
  partners: DocumentPartnerRow[]
): DocumentPartnerRow[] {
  return candidates
    .map((candidate) => partners.find((partner) => partner.id === candidate.id) ?? null)
    .filter(Boolean) as DocumentPartnerRow[];
}

function normalizePartnerNo(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return String(parseInt(digits, 10));
}

function matchByPartnerNo(
  partnerNo: string | null | undefined,
  partners: DocumentPartnerRow[]
): DocumentPartnerRow | null {
  const key = normalizePartnerNo(partnerNo);
  if (!key) return null;

  const matches = partners.filter(
    (partner) => normalizePartnerNo(partner.external_no) === key
  );
  return matches.length === 1 ? matches[0]! : null;
}

function toCandidateMatch(
  resolved: CompanyResolveResult,
  queryUsed: string,
  partners: DocumentPartnerRow[]
): CandidateMatch | null {
  if (!resolved.partner) return null;
  const partner = partners.find((row) => row.id === resolved.partner!.id);
  if (!partner) return null;

  return {
    partner,
    method: strategyToMethod(resolved.strategy),
    confidence: resolved.confidence,
    strategy: resolved.strategy,
    queryUsed
  };
}

function findBestCandidateMatch(
  names: string[],
  partners: DocumentPartnerRow[]
): { best: CandidateMatch | null; resolved: CompanyResolveResult | null } {
  let best: CandidateMatch | null = null;
  let bestResolved: CompanyResolveResult | null = null;

  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length < 2) continue;

    const resolved = resolveCompanyName(trimmed, partners);
    const candidate = toCandidateMatch(resolved, trimmed, partners);
    if (!candidate) continue;

    if (
      !best ||
      candidate.confidence > best.confidence ||
      (candidate.confidence === best.confidence && candidate.strategy === "exact")
    ) {
      best = candidate;
      bestResolved = resolved;
    }
  }

  return { best, resolved: bestResolved };
}

/** exact/alias/includes만 자동 저장. fuzzy·ambiguous·low_confidence는 제외 */
function isStrongMatch(match: CandidateMatch): boolean {
  return (
    match.confidence >= PARTNER_MATCH_CONFIDENCE_THRESHOLD &&
    match.strategy !== "ambiguous" &&
    match.strategy !== "low_confidence" &&
    match.strategy !== "none" &&
    match.strategy !== "fuzzy"
  );
}

function buildNeedsReviewResult(input: {
  partner: DocumentPartnerRow | null;
  method: DocumentMatchMethod | null;
  confidence: number;
  reason: string;
  candidates: DocumentPartnerRow[];
}): DocumentMatchResult {
  return {
    partner: input.partner,
    match_status: "needs_review",
    match_method: input.method,
    match_confidence: input.confidence,
    reason: input.reason,
    save_enabled: false,
    candidates: input.candidates
  };
}

function buildUnmatchedResult(input: {
  reason: string;
  method?: DocumentMatchMethod | null;
  confidence?: number;
  candidates?: DocumentPartnerRow[];
}): DocumentMatchResult {
  return {
    partner: null,
    match_status: "unmatched",
    match_method: input.method ?? null,
    match_confidence: input.confidence ?? 0,
    reason: input.reason,
    save_enabled: false,
    candidates: input.candidates ?? []
  };
}

function buildMatchedResult(input: {
  partner: DocumentPartnerRow;
  method: DocumentMatchMethod;
  confidence: number;
  reason: string;
}): DocumentMatchResult {
  return {
    partner: input.partner,
    match_status: "matched",
    match_method: input.method,
    match_confidence: input.confidence,
    reason: input.reason,