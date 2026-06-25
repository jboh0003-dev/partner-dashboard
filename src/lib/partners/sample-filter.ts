/** 샘플/데모/테스트 파트너 식별 패턴 */
const SAMPLE_PARTNER_PATTERN =
  /sample|test|demo|dummy|mock|seed|fixture|example|예시|샘플|테스트|데모|개발용|임시\s*데이터|더미/i;

type PartnerLike = {
  id?: string;
  company_name?: string | null;
  external_no?: string | null;
  memo?: string | null;
};

export function isSamplePartnerName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return SAMPLE_PARTNER_PATTERN.test(name.trim());
}

/** 파트너 마스터 기준 샘플 여부 (회사명·외부번호·메모) */
export function isSamplePartner(partner: PartnerLike | null | undefined): boolean {
  if (!partner) return false;
  return [partner.company_name, partner.external_no, partner.memo].some((value) =>
    isSamplePartnerName(value)
  );
}

export function filterSamplePartners<T extends PartnerLike>(partners: T[]): T[] {
  return partners.filter((partner) => !isSamplePartner(partner));
}

export function getRealPartnerIdSet(partners: PartnerLike[]): Set<string> {
  return new Set(
    partners
      .filter((partner) => partner.id && !isSamplePartner(partner))
      .map((partner) => partner.id as string)
  );
}

/** join된 partner_name 기준 필터 */
export function filterRowsByPartnerName<T extends { partner_name?: string | null }>(
  rows: T[]
): T[] {
  return rows.filter((row) => !isSamplePartnerName(row.partner_name));
}

export function filterRowsByPartnerId<T extends { partner_id: string }>(
  rows: T[],
  realPartnerIds: Set<string>
): T[] {
  return rows.filter((row) => realPartnerIds.has(row.partner_id));
}
