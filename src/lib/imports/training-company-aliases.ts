import { normalizeCompanyName } from "@/lib/partner-match";

/**
 * 정기/기술파트너 교육 업로드 매칭 전용 별칭.
 * partners.company_name 은 변경하지 않으며, 엑셀 회사명 조회 키만 정규화한다.
 * 동일 표기의 파트너가 이미 있으면 exact match가 우선한다.
 */
const TRAINING_COMPANY_ALIAS_GROUPS: Array<{
  canonicalName: string;
  aliases: string[];
}> = [
  {
    canonicalName: "효성인포메이션시스템",
    aliases: ["효성인포메이션", "에이치에스효성인포메이션시스템"]
  },
  {
    canonicalName: "아름정보",
    aliases: ["포스텍"]
  }
];

const ALIAS_TO_CANONICAL = new Map<string, string>();

for (const group of TRAINING_COMPANY_ALIAS_GROUPS) {
  const canonical = normalizeCompanyName(group.canonicalName);
  if (!canonical) continue;
  for (const alias of group.aliases) {
    const key = normalizeCompanyName(alias);
    if (key && key !== canonical) ALIAS_TO_CANONICAL.set(key, canonical);
  }
}

/** 엑셀 회사명이 등록된 별칭이면 canonical 정규화 키를 반환 */
export function resolveTrainingCompanyAliasKey(
  companyName: string | null | undefined
): string | null {
  const key = normalizeCompanyName(companyName);
  if (!key) return null;
  return ALIAS_TO_CANONICAL.get(key) ?? null;
}
