import type { DocumentMatchMethod, DocumentMatchStatus } from "@/lib/documents/constants";
import { namesAreConsistent } from "@/lib/documents/display";
import {
  shouldFlagContractDateMismatch,
  shouldIgnoreNameMismatchForReview
} from "@/lib/documents/review-rules";
import {
  companyNamesMatchWithVariants,
  matchReasonForStrategy
} from "@/lib/documents/partner-aliases";
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

function partnersConflict(
  left: CandidateMatch | null,
  right: CandidateMatch | null
): boolean {
  if (!left || !right) return false;
  if (left.partner.id === right.partner.id) return false;
  if (left.confidence < 60 || right.confidence < 60) return false;
  return !namesAreConsistent(left.queryUsed, right.partner.company_name);
}

function extractedSourceNamesConflict(
  folderLabel: string | null,
  fileLabel: string | null
): boolean {
  if (!folderLabel || !fileLabel) return false;
  return !companyNamesMatchWithVariants(folderLabel, fileLabel);
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
    save_enabled: true,
    candidates: [input.partner]
  };
}

function matchedReason(
  match: CandidateMatch,
  sourceLabel: string
): string {
  if (match.strategy === "alias") return REASON.alias;
  return matchReasonForStrategy(match.strategy, sourceLabel, match.queryUsed);
}

function resolveCandidateAttempt(
  match: { best: CandidateMatch | null; resolved: CompanyResolveResult | null },
  context: {
    sourceLabel: string;
    partners: DocumentPartnerRow[];
  }
): DocumentMatchResult | null {
  if (match.resolved?.strategy === "ambiguous") {
    return buildNeedsReviewResult({
      partner: null,
      method: match.best?.method ?? null,
      confidence: match.best?.confidence ?? 0,
      reason: REASON.ambiguous,
      candidates: mapCandidates(match.resolved.candidates.slice(0, 5), context.partners)
    });
  }

  if (match.best?.strategy === "fuzzy") {
    return buildNeedsReviewResult({
      partner: null,
      method: "fuzzy",
      confidence: match.best.confidence,
      reason: REASON.fuzzy,
      candidates: mapCandidates(match.resolved?.candidates.slice(0, 5) ?? [], context.partners)
    });
  }

  if (match.best && !isStrongMatch(match.best)) {
    return buildNeedsReviewResult({
      partner: null,
      method: match.best.method,
      confidence: match.best.confidence,
      reason: REASON.manualRequired,
      candidates: mapCandidates(
        [match.best.partner, ...(match.resolved?.candidates ?? [])].slice(0, 5),
        context.partners
      )
    });
  }

  return null;
}

function hasExtractedCompanyName(
  folderCandidates: string[],
  filenameCandidates: string[],
  folderNormalizedName: string | null,
  filenamePartnerName: string | null | undefined
): boolean {
  return Boolean(
    folderNormalizedName?.trim() ||
      folderCandidates.length > 0 ||
      filenamePartnerName?.trim() ||
      filenameCandidates.length > 0
  );
}

export function matchDocumentPartner(input: {
  folderCandidates?: string[];
  folderNormalizedName?: string | null;
  isGenericFolder?: boolean;
  filenamePartnerName?: string | null;
  filenameCandidates?: string[];
  sourceFolderName?: string | null;
  partnerNo?: string | null;
  partners: DocumentPartnerRow[];
  manualPartnerId?: string | null;
}): DocumentMatchResult {
  const {
    folderCandidates = [],
    folderNormalizedName = null,
    isGenericFolder = false,
    filenamePartnerName,
    filenameCandidates = [],
    partners,
    manualPartnerId
  } = input;

  if (manualPartnerId) {
    const manual = partners.find((partner) => partner.id === manualPartnerId) ?? null;
    if (!manual) {
      return buildNeedsReviewResult({
        partner: null,
        method: "manual",
        confidence: 0,
        reason: REASON.manualRequired,
        candidates: []
      });
    }

    return buildMatchedResult({
      partner: manual,
      method: "manual",
      confidence: 100,
      reason: "수동 파트너 확인"
    });
  }

  const partnerNoMatch = matchByPartnerNo(input.partnerNo, partners);
  if (partnerNoMatch) {
    return buildMatchedResult({
      partner: partnerNoMatch,
      method: "exact",
      confidence: 98,
      reason: "파트너번호 일치"
    });
  }

  const effectiveFolderCandidates = isGenericFolder ? [] : uniqueStrings(folderCandidates);
  const effectiveFilenameCandidates = uniqueStrings([
    ...(filenamePartnerName ? [filenamePartnerName] : []),
    ...filenameCandidates
  ]);

  const folderLabel =
    folderNormalizedName ?? effectiveFolderCandidates[0] ?? null;
  const fileLabel =
    filenamePartnerName ?? effectiveFilenameCandidates[0] ?? null;

  if (
    !isGenericFolder &&
    extractedSourceNamesConflict(folderLabel, fileLabel)
  ) {
    return buildNeedsReviewResult({
      partner: null,
      method: null,
      confidence: 0,
      reason: REASON.sourceConflict,
      candidates: []
    });
  }

  const folderMatch = findBestCandidateMatch(effectiveFolderCandidates, partners);
  const filenameMatch = findBestCandidateMatch(effectiveFilenameCandidates, partners);

  if (
    folderMatch.best &&
    filenameMatch.best &&
    isStrongMatch(folderMatch.best) &&
    isStrongMatch(filenameMatch.best) &&
    partnersConflict(folderMatch.best, filenameMatch.best)
  ) {
    return buildNeedsReviewResult({
      partner: null,
      method: null,
      confidence: Math.max(folderMatch.best.confidence, filenameMatch.best.confidence),
      reason: REASON.sourceConflict,
      candidates: mapCandidates(
        [folderMatch.best.partner, filenameMatch.best.partner],
        partners
      )
    });
  }

  if (effectiveFolderCandidates.length > 0) {
    if (folderMatch.best && isStrongMatch(folderMatch.best)) {
      return buildMatchedResult({
        partner: folderMatch.best.partner,
        method: "folder",
        confidence: folderMatch.best.confidence,
        reason: matchedReason(folderMatch.best, "폴더명")
      });
    }
  }

  if (effectiveFilenameCandidates.length > 0) {
    if (filenameMatch.best && isStrongMatch(filenameMatch.best)) {
      const fileMethod = filenameMatch.best.method ?? "exact";

      return buildMatchedResult({
        partner: filenameMatch.best.partner,
        method: fileMethod,
        confidence: filenameMatch.best.confidence,
        reason: matchedReason(filenameMatch.best, "파일명")
      });
    }
  }

  const folderReview = effectiveFolderCandidates.length
    ? resolveCandidateAttempt(folderMatch, { sourceLabel: "폴더명", partners })
    : null;

  const filenameReview = effectiveFilenameCandidates.length
    ? resolveCandidateAttempt(filenameMatch, { sourceLabel: "파일명", partners })
    : null;

  if (folderReview && filenameReview) {
    if ((folderReview.match_confidence ?? 0) >= (filenameReview.match_confidence ?? 0)) {
      return folderReview;
    }
    return filenameReview;
  }

  if (folderReview) return folderReview;
  if (filenameReview) return filenameReview;

  if (isGenericFolder) {
    if (
      hasExtractedCompanyName(
        effectiveFolderCandidates,
        effectiveFilenameCandidates,
        folderNormalizedName,
        filenamePartnerName
      )
    ) {
      return buildUnmatchedResult({ reason: REASON.unregistered });
    }

    return buildNeedsReviewResult({
      partner: null,
      method: null,
      confidence: 0,
      reason: REASON.genericFolder,
      candidates: []
    });
  }

  if (
    hasExtractedCompanyName(
      effectiveFolderCandidates,
      effectiveFilenameCandidates,
      folderNormalizedName,
      filenamePartnerName
    )
  ) {
    return buildUnmatchedResult({ reason: REASON.unregistered });
  }

  return buildUnmatchedResult({ reason: REASON.manualRequired });
}

export function evaluateExistingDocumentMatch(input: {
  extractedPartnerName: string | null;
  partnerCompanyName: string;
  matchConfidence?: number | null;
  matchMethod?: string | null;
  documentType?: string | null;
  contractDate?: string | null;
  periodYear?: number | null;
}): Pick<DocumentMatchResult, "match_status" | "match_confidence" | "reason" | "save_enabled"> {
  if (input.matchMethod === "manual" || input.matchMethod === "folder") {
    return {
      match_status: "matched",
      match_confidence: input.matchConfidence ?? 90,
      reason: "확인된 파트너 매칭",
      save_enabled: true
    };
  }

  const consistent = namesAreConsistent(input.extractedPartnerName, input.partnerCompanyName);
  const confidence = input.matchConfidence ?? (consistent ? 90 : 40);

  if (!input.extractedPartnerName?.trim()) {
    return {
      match_status: "matched",
      match_confidence: confidence,
      reason: "파일명 회사명 추출 없음",
      save_enabled: true
    };
  }

  if (
    !consistent &&
    shouldIgnoreNameMismatchForReview({
      document_type: input.documentType,
      extracted_partner_name: input.extractedPartnerName
    })
  ) {
    return {
      match_status: "matched",
      match_confidence: confidence,
      reason: "연도·참고 정보는 확인 필요 대상에서 제외",
      save_enabled: true
    };
  }

  if (!consistent) {
    return {
      match_status: "needs_review",
      match_confidence: Math.min(confidence, 50),
      reason: REASON.sourceConflict,
      save_enabled: false
    };
  }

  if (
    shouldFlagContractDateMismatch({
      document_type: input.documentType,
      contract_date: input.contractDate,
      period_year: input.periodYear,
      extracted_partner_name: input.extractedPartnerName
    })
  ) {
    return {
      match_status: "needs_review",
      match_confidence: Math.min(confidence, 60),
      reason: "계약일자와 문서 연도가 다릅니다.",
      save_enabled: false
    };
  }

  if (confidence < PARTNER_MATCH_CONFIDENCE_THRESHOLD) {
    return {
      match_status: "needs_review",
      match_confidence: confidence,
      reason: REASON.manualRequired,
      save_enabled: false
    };
  }

  return {
    match_status: "matched",
    match_confidence: confidence,
    reason: "파트너 매칭 확인됨",
    save_enabled: true
  };
}
