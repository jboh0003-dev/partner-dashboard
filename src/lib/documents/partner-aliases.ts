import { normalizeCompanyName } from "@/lib/partner-match";

/**
 * 문서 업로드 매칭용 파트너 별칭 그룹.
 * canonicalName: partners.company_name 과 일치하는 정식명
 * aliases: 폴더/파일명에서 나올 수 있는 표기 변형
 *
 * 새 별칭 추가 시 아래 배열에 항목만 추가하면 됩니다.
 */
export const DOCUMENT_PARTNER_ALIAS_GROUPS: Array<{
  canonicalName: string;
  aliases: string[];
}> = [
  {
    canonicalName: "아이윌아이엔씨",
    aliases: ["아이윌아이앤씨", "아이윌"]
  }
];

let aliasLookupCache: Record<string, string> | null = null;

/** 별칭(소문자) → 정규화된 company_name 키 */
export function buildDocumentPartnerAliasMap(): Record<string, string> {
  const map: Record<string, string> = {};

  for (const group of DOCUMENT_PARTNER_ALIAS_GROUPS) {
    const targetKey = normalizeCompanyName(group.canonicalName);
    if (!targetKey) continue;

    map[group.canonicalName.toLowerCase().trim()] = targetKey;

    for (const alias of group.aliases) {
      const key = alias.toLowerCase().trim();
      if (key) map[key] = targetKey;
    }
  }

  return map;
}

function getAliasLookup(): Record<string, string> {
  aliasLookupCache ??= buildDocumentPartnerAliasMap();
  return aliasLookupCache;
}

/** 입력 문자열이 등록된 별칭이면 정규화된 company_name 키 반환 */
export function lookupDocumentPartnerAlias(value: string | null | undefined): string | null {
  const key = value?.trim().toLowerCase();
  if (!key) return null;
  return getAliasLookup()[key] ?? null;
}

/** 앤/엔 등 흔한 표기 차이에 대한 정규화 키 변형 */
export function getSpellingVariantKeys(normalized: string): string[] {
  const variants = new Set<string>([normalized]);

  if (normalized.includes("앤")) {
    variants.add(normalized.replace(/앤/g, "엔"));
  }
  if (normalized.includes("엔")) {
    variants.add(normalized.replace(/엔/g, "앤"));
  }
  if (normalized.includes("앤씨")) {
    variants.add(normalized.replace(/앤씨/g, "엔씨"));
  }
  if (normalized.includes("엔씨")) {
    variants.add(normalized.replace(/엔씨/g, "앤씨"));
  }

  return Array.from(variants);
}

/** 두 회사명이 동일·별칭·철자변형·포함 관계인지 판단 */
export function companyNamesMatchWithVariants(
  left: string | null | undefined,
  right: string | null | undefined
): boolean {
  const normLeft = normalizeCompanyName(left);
  const normRight = normalizeCompanyName(right);
  if (!normLeft || !normRight) return false;

  if (normLeft === normRight) return true;

  const aliasLeft = lookupDocumentPartnerAlias(left);
  const aliasRight = lookupDocumentPartnerAlias(right);
  if (aliasLeft && aliasLeft === normRight) return true;
  if (aliasRight && aliasRight === normLeft) return true;
  if (aliasLeft && aliasRight && aliasLeft === aliasRight) return true;

  for (const variantLeft of getSpellingVariantKeys(normLeft)) {
    if (variantRightEquals(variantLeft, normRight)) return true;
    for (const variantRight of getSpellingVariantKeys(normRight)) {
      if (variantLeft === variantRight) return true;
    }
  }

  if (normLeft.length >= 2 && normRight.includes(normLeft)) return true;
  if (normRight.length >= 2 && normLeft.includes(normRight)) return true;

  return false;
}

function variantRightEquals(left: string, right: string): boolean {
  if (left === right) return true;
  return getSpellingVariantKeys(right).includes(left);
}

export function matchReasonForStrategy(
  strategy: CompanyMatchStrategyLike,
  sourceLabel: string,
  queryUsed: string
): string {
  if (strategy === "alias") return "별칭 기준으로 매칭되었습니다.";
  return `${sourceLabel} 기준 매칭 (${queryUsed})`;
}

type CompanyMatchStrategyLike = "exact" | "alias" | "includes" | "fuzzy" | string;
