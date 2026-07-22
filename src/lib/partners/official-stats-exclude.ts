import { normalizeCompanyName } from "@/lib/partner-match";

/**
 * 공식 파트너 현황/통계에서 제외할 회사 (정규화 키).
 * DB 레코드는 유지하고 파이프라인·딜 조회에는 영향 없음.
 */
export const OFFICIAL_PARTNER_EXCLUDED_COMPANIES = new Set([
  "투모로우넷",
  "tomorrownet"
]);

type PartnerLike = {
  company_name?: string | null;
  contract_display_name?: string | null;
};

/** 통계 제외 판별용 회사명 정규화 (기존 partner-match 규칙 재사용) */
export function normalizeOfficialStatsCompanyName(name: string | null | undefined): string | null {
  return normalizeCompanyName(name);
}

export function isExcludedFromOfficialPartnerStats(
  partner: PartnerLike | string | null | undefined
): boolean {
  if (partner == null) return false;

  const names =
    typeof partner === "string"
      ? [partner]
      : [partner.company_name, partner.contract_display_name];

  for (const name of names) {
    const normalized = normalizeOfficialStatsCompanyName(name);
    if (normalized && OFFICIAL_PARTNER_EXCLUDED_COMPANIES.has(normalized)) {
      return true;
    }
  }
  return false;
}

/** 공식 파트너 통계/기본 목록용 필터 */
export function filterOfficialPartnerStatsPartners<T extends PartnerLike>(partners: T[]): T[] {
  return partners.filter((partner) => !isExcludedFromOfficialPartnerStats(partner));
}
