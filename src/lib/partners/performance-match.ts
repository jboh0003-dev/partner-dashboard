import { companyNamesMatchWithVariants } from "@/lib/documents/partner-aliases";
import {
  getExactCompanyNameKey,
  normalizeBusinessNumber,
  normalizeCompanyName
} from "@/lib/partner-match";
import {
  PARTNER_MATCH_CONFIDENCE_THRESHOLD,
  resolveCompanyName
} from "@/lib/search/fuzzy-company";

export type PerformanceMatchStatus =
  | "matched"
  | "unmatched"
  | "unknown_partner"
  | "not_partner"
  | "review";

export type PerformancePartnerRow = {
  id: string;
  company_name: string;
  business_number?: string | null;
};

export type PartnerAliasRow = {
  partner_id: string;
  alias_name: string;
  normalized_alias: string;
};

const UNKNOWN_PARTNER_TOKENS = new Set([
  "",
  "0",
  "-",
  "미정",
  "미기재",
  "없음",
  "n/a",
  "na",
  "tbd",
  "null",
  "none",
  "미확인",
  "확인필요",
  "확인 필요"
]);

const CORPORATE_SUFFIX_RE =
  /\b(inc|inckorea|incorporated|corp|corporation|co|ltd|limited|llc|gmbh|korea)\b/gi;

const HANGUL_ACRONYM_CHUNKS: Array<[string, string]> = (
  [
    ["에스", "s"],
    ["디", "d"],
    ["피", "p"],
    ["케이", "k"],
    ["지", "g"],
    ["에이", "a"],
    ["엔", "n"],
    ["아이", "i"],
    ["티", "t"],
    ["엠", "m"],
    ["오", "o"],
    ["유", "u"],
    ["브이", "v"],
    ["더블유", "w"],
    ["엑스", "x"],
    ["와이", "y"],
    ["제트", "z"],
    ["알", "r"],
    ["씨", "c"],
    ["에프", "f"],
    ["에이치", "h"],
    ["큐", "q"]
  ] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

/** 엑셀 원본 파트너명이 비어 있거나 미기재 토큰인지 */
export function isUnknownPartnerName(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  return UNKNOWN_PARTNER_TOKENS.has(trimmed.toLowerCase());
}

/** 실적/파이프라인용 회사명 정규화 (법인표기·괄호·특수문자 제거) */
export function normalizePerformancePartnerName(value?: string | null): string | null {
  if (!value) return null;

  let text = value.trim().toLowerCase();
  if (!text) return null;

  text = text.replace(/㈜/g, "");
  text = text.replace(/주식회사/g, "");
  text = text.replace(/\(주\)/g, "");
  text = text.replace(CORPORATE_SUFFIX_RE, " ");
  text = text.replace(/\([^)]*\)/g, "");
  text = text.replace(/\[[^\]]*\]/g, "");
  text = text.replace(/\s+/g, "");
  text = text.replace(/[^\p{L}\p{N}]/gu, "");

  return text || null;
}

/** 괄호 안 별칭 + 괄호 제거본 등 매칭용 키 목록 */
export function getPerformanceNameKeys(value?: string | null): string[] {
  if (!value?.trim()) return [];

  const keys = new Set<string>();
  const base = normalizePerformancePartnerName(value);
  if (base) keys.add(base);

  const withoutParens = value.replace(/\([^)]*\)/g, "").replace(/\[[^\]]*\]/g, "");
  const stripped = normalizePerformancePartnerName(withoutParens);
  if (stripped) keys.add(stripped);

  const parenMatches = value.matchAll(/\(([^)]+)\)/g);
  for (const match of parenMatches) {
    const inner = normalizePerformancePartnerName(match[1]);
    if (inner) keys.add(inner);
  }

  const bracketMatches = value.matchAll(/\[([^\]]+)\]/g);
  for (const match of bracketMatches) {
    const inner = normalizePerformancePartnerName(match[1]);
    if (inner) keys.add(inner);
  }

  const legacy = normalizeCompanyName(value);
  if (legacy) keys.add(legacy);

  return Array.from(keys);
}

function hangulNameToLatinAcronym(name: string): string {
  let remaining = normalizePerformancePartnerName(name) ?? "";
  let result = "";

  while (remaining.length > 0) {
    let matched = false;
    for (const [chunk, letter] of HANGUL_ACRONYM_CHUNKS) {
      if (remaining.startsWith(chunk)) {
        result += letter;
        remaining = remaining.slice(chunk.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      remaining = remaining.slice(1);
    }
  }

  return result;
}

function matchByLatinAcronym(
  query: string,
  partners: PerformancePartnerRow[]
): PerformancePartnerRow | null {
  const latin = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (latin.length < 2 || latin.length > 6) return null;

  const matches = partners.filter((partner) => {
    const acronym = hangulNameToLatinAcronym(partner.company_name);
    return acronym === latin;
  });

  return matches.length === 1 ? matches[0]! : null;
}

function matchByPrefix(
  keys: string[],
  partners: PerformancePartnerRow[]
): PerformancePartnerRow | null {
  const matches = partners.filter((partner) => {
    const partnerKeys = getPerformanceNameKeys(partner.company_name);
    return keys.some(
      (key) =>
        key.length >= 3 &&
        partnerKeys.some(
          (partnerKey) =>
            partnerKey.startsWith(key) ||
            key.startsWith(partnerKey) ||
            (partnerKey.includes(key) && key.length >= 3) ||
            (key.includes(partnerKey) && partnerKey.length >= 4)
        )
    );
  });

  return matches.length === 1 ? matches[0]! : null;
}

function buildAliasMap(aliases: PartnerAliasRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const alias of aliases) {
    map.set(alias.normalized_alias, alias.partner_id);
  }
  return map;
}

function buildBusinessNumberMap(partners: PerformancePartnerRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const partner of partners) {
    const bn = normalizeBusinessNumber(partner.business_number);
    if (bn) map.set(bn, partner.id);
  }
  return map;
}

export type PerformanceMatchResult = {
  partner: PerformancePartnerRow | null;
  match_status: PerformanceMatchStatus;
  match_reason: string | null;
  match_strategy: string | null;
};

export function matchPerformancePartnerName(
  rawName: string | null | undefined,
  partners: PerformancePartnerRow[],
  options?: {
    aliases?: PartnerAliasRow[];
    businessNumber?: string | null;
  }
): PerformanceMatchResult {
  if (isUnknownPartnerName(rawName)) {
    return {
      partner: null,
      match_status: "unknown_partner",
      match_reason: "파트너 미기재",
      match_strategy: null
    };
  }

  const name = rawName!.trim();
  const keys = getPerformanceNameKeys(name);
  const aliasMap = buildAliasMap(options?.aliases ?? []);
  const businessMap = buildBusinessNumberMap(partners);

  for (const key of keys) {
    const partnerId = aliasMap.get(key);
    if (partnerId) {
      const partner = partners.find((p) => p.id === partnerId) ?? null;
      if (partner) {
        return {
          partner,
          match_status: "matched",
          match_reason: null,
          match_strategy: "partner_alias"
        };
      }
    }
  }

  const exact = partners.filter(
    (p) => p.company_name.trim().toLowerCase() === name.toLowerCase()
  );
  if (exact.length === 1) {
    return {
      partner: exact[0]!,
      match_status: "matched",
      match_reason: null,
      match_strategy: "exact_name"
    };
  }
  if (exact.length > 1) {
    return {
      partner: null,
      match_status: "review",
      match_reason: "동일 파트너사명이 여러 건입니다.",
      match_strategy: "exact_name"
    };
  }

  for (const key of keys) {
    const normalizedMatches = partners.filter(
      (p) => normalizePerformancePartnerName(p.company_name) === key
    );
    if (normalizedMatches.length === 1) {
      return {
        partner: normalizedMatches[0]!,
        match_status: "matched",
        match_reason: null,
        match_strategy: "normalized_name"
      };
    }
    if (normalizedMatches.length > 1) {
      return {
        partner: null,
        match_status: "review",
        match_reason: "정규화 파트너사명이 여러 건입니다.",
        match_strategy: "normalized_name"
      };
    }
  }

  const variantMatches = partners.filter((p) => companyNamesMatchWithVariants(name, p.company_name));
  if (variantMatches.length === 1) {
    return {
      partner: variantMatches[0]!,
      match_status: "matched",
      match_reason: null,
      match_strategy: "variant"
    };
  }
  if (variantMatches.length > 1) {
    return {
      partner: null,
      match_status: "review",
      match_reason: "유사 파트너사명이 여러 건입니다.",
      match_strategy: "variant"
    };
  }

  const bn = normalizeBusinessNumber(options?.businessNumber);
  if (bn && businessMap.has(bn)) {
    const partner = partners.find((p) => p.id === businessMap.get(bn)!) ?? null;
    if (partner) {
      return {
        partner,
        match_status: "matched",
        match_reason: null,
        match_strategy: "business_number"
      };
    }
  }

  const prefixMatch = matchByPrefix(keys, partners);
  if (prefixMatch) {
    return {
      partner: prefixMatch,
      match_status: "matched",
      match_reason: null,
      match_strategy: "prefix"
    };
  }

  const acronymMatch = matchByLatinAcronym(name, partners);
  if (acronymMatch) {
    return {
      partner: acronymMatch,
      match_status: "matched",
      match_reason: null,
      match_strategy: "latin_acronym"
    };
  }

  const exactKey = getExactCompanyNameKey(name);
  const includes = partners.filter((p) => {
    const key = getExactCompanyNameKey(p.company_name);
    return key && exactKey && (key.includes(exactKey) || exactKey.includes(key));
  });
  if (includes.length === 1) {
    return {
      partner: includes[0]!,
      match_status: "matched",
      match_reason: null,
      match_strategy: "includes"
    };
  }
  if (includes.length > 1) {
    return {
      partner: null,
      match_status: "review",
      match_reason: "포함 검색 파트너 후보가 여러 건입니다.",
      match_strategy: "includes"
    };
  }

  const fuzzy = resolveCompanyName(name, partners);
  if (fuzzy.partner && fuzzy.confidence >= PARTNER_MATCH_CONFIDENCE_THRESHOLD) {
    return {
      partner: fuzzy.partner,
      match_status: "matched",
      match_reason: null,
      match_strategy: `fuzzy_${fuzzy.strategy}`
    };
  }

  if (fuzzy.candidates.length > 0) {
    return {
      partner: null,
      match_status: "review",
      match_reason:
        fuzzy.strategy === "ambiguous"
          ? "유사 파트너 후보가 여러 건입니다."
          : `등록된 파트너사를 찾지 못했습니다. (후보: ${fuzzy.candidates
              .slice(0, 3)
              .map((c) => c.company_name)
              .join(", ")})`,
      match_strategy: fuzzy.strategy
    };
  }

  return {
    partner: null,
    match_status: "unmatched",
    match_reason: "등록된 파트너사를 찾지 못했습니다.",
    match_strategy: null
  };
}

export function toImportMatchStatus(
  status: PerformanceMatchStatus
): "matched" | "review" {
  return status === "matched" ? "matched" : "review";
}
