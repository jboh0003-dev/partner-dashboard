import type { ParsedPartnerMasterRow } from "@/lib/excel/parse-partner-master";
import {
  getExactCompanyNameKey,
  normalizeBusinessNumber,
  normalizeCompanyName
} from "@/lib/partner-match";

export type PartnerMasterDbRow = {
  id: string;
  company_name: string;
  business_number: string | null;
  external_no?: string | null;
  contract_start_date?: string | null;
  grade?: string | null;
  grade_raw?: string | null;
  website?: string | null;
  ceo_name?: string | null;
  address?: string | null;
  region_group?: string | null;
  region?: string | null;
  city?: string | null;
  okestro_owner?: string | null;
  sales_owner?: string | null;
  contract_contact_name?: string | null;
  contract_contact_phone?: string | null;
  contract_contact_email?: string | null;
  revenue_2023?: string | null;
  employee_count?: string | null;
  credit_rating?: string | null;
};

export type PartnerMasterAnalysisAction = "create" | "update" | "skip" | "review";

export type PartnerMasterAnalysisItem = {
  row_number: number;
  company_name: string;
  business_number: string | null;
  action: PartnerMasterAnalysisAction;
  reason: string;
  changed_fields: string[];
  matched_partner_id: string | null;
};

export type PartnerMasterAnalysisSummary = {
  total: number;
  create: number;
  update: number;
  skip: number;
  review: number;
};

export function analyzePartnerMasterRows(
  rows: ParsedPartnerMasterRow[],
  existingPartners: PartnerMasterDbRow[]
): {
  items: PartnerMasterAnalysisItem[];
  summary: PartnerMasterAnalysisSummary;
} {
  const byBusinessNumber = new Map<string, PartnerMasterDbRow[]>();
  const byExactName = new Map<string, PartnerMasterDbRow[]>();
  const byNormalizedName = new Map<string, PartnerMasterDbRow[]>();

  for (const partner of existingPartners) {
    const businessNumber = normalizeBusinessNumber(partner.business_number);
    if (businessNumber) {
      const list = byBusinessNumber.get(businessNumber) ?? [];
      list.push(partner);
      byBusinessNumber.set(businessNumber, list);
    }

    const exactName = getExactCompanyNameKey(partner.company_name);
    if (exactName) {
      const list = byExactName.get(exactName) ?? [];
      list.push(partner);
      byExactName.set(exactName, list);
    }

    const normalizedName = normalizeCompanyName(partner.company_name);
    if (normalizedName) {
      const list = byNormalizedName.get(normalizedName) ?? [];
      list.push(partner);
      byNormalizedName.set(normalizedName, list);
    }
  }

  const items = rows.map((row) => analyzeRow(row, byBusinessNumber, byExactName, byNormalizedName));
  const summary = items.reduce<PartnerMasterAnalysisSummary>(
    (acc, item) => {
      acc.total += 1;
      acc[item.action] += 1;
      return acc;
    },
    { total: 0, create: 0, update: 0, skip: 0, review: 0 }
  );

  return { items, summary };
}

function analyzeRow(
  row: ParsedPartnerMasterRow,
  byBusinessNumber: Map<string, PartnerMasterDbRow[]>,
  byExactName: Map<string, PartnerMasterDbRow[]>,
  byNormalizedName: Map<string, PartnerMasterDbRow[]>
): PartnerMasterAnalysisItem {
  if (row.excluded) {
    return {
      row_number: row.row_number,
      company_name: row.company_name,
      business_number: row.business_number,
      action: "skip",
      reason: row.excluded_reason ?? "제외",
      changed_fields: [],
      matched_partner_id: null
    };
  }

  const businessMatches = row.normalized_business_number
    ? byBusinessNumber.get(row.normalized_business_number) ?? []
    : [];
  const exactNameMatches = row.company_name
    ? byExactName.get(getExactCompanyNameKey(row.company_name) ?? "") ?? []
    : [];
  const normalizedNameMatches = row.normalized_company_name
    ? byNormalizedName.get(row.normalized_company_name) ?? []
    : [];

  if (row.normalized_business_number && businessMatches.length > 1) {
    return reviewItem(row, "사업자번호로 여러 파트너가 조회됩니다.");
  }

  if (exactNameMatches.length > 1) {
    return reviewItem(row, "회사명 원문 완전일치 결과가 여러 건입니다.");
  }

  if (!row.normalized_business_number && exactNameMatches.length === 0 && normalizedNameMatches.length > 1) {
    return reviewItem(row, "정규화 회사명 후보가 여러 건입니다.");
  }

  if (
    row.normalized_business_number &&
    businessMatches.length === 1 &&
    exactNameMatches.length > 0 &&
    !exactNameMatches.some((partner) => partner.id === businessMatches[0].id)
  ) {
    return reviewItem(row, "사업자번호 매칭과 회사명 원문 매칭 결과가 서로 다릅니다.");
  }

  let matchedPartner: PartnerMasterDbRow | null = null;
  let matchReason = "";

  if (businessMatches.length === 1) {
    matchedPartner = businessMatches[0];
    matchReason = "사업자번호 매칭";
  } else if (exactNameMatches.length === 1) {
    matchedPartner = exactNameMatches[0];
    matchReason = "회사명 원문 완전일치";
  } else if (normalizedNameMatches.length === 1) {
    matchedPartner = normalizedNameMatches[0];
    matchReason = "회사명 정규화 후보 매칭";
  }

  if (!matchedPartner) {
    return {
      row_number: row.row_number,
      company_name: row.company_name,
      business_number: row.business_number,
      action: "create",
      reason: "신규 파트너 생성",
      changed_fields: getChangedFields(row, null),
      matched_partner_id: null
    };
  }

  const changedFields = getChangedFields(row, matchedPartner);
  return {
    row_number: row.row_number,
    company_name: row.company_name,
    business_number: row.business_number,
    action: "update",
    reason: changedFields.length > 0 ? matchReason : `${matchReason} (변경 없음)`,
    changed_fields: changedFields,
    matched_partner_id: matchedPartner.id
  };
}

function reviewItem(row: ParsedPartnerMasterRow, reason: string): PartnerMasterAnalysisItem {
  return {
    row_number: row.row_number,
    company_name: row.company_name,
    business_number: row.business_number,
    action: "review",
    reason,
    changed_fields: [],
    matched_partner_id: null
  };
}

export function getChangedFields(
  row: ParsedPartnerMasterRow,
  existing: PartnerMasterDbRow | null
): string[] {
  const fields: Array<[string, string | null, string | null | undefined]> = [
    ["external_no", row.external_no, existing?.external_no],
    ["contract_start_date", row.contract_start_date, existing?.contract_start_date],
    ["company_name", row.company_name, existing?.company_name],
    ["grade", row.grade, existing?.grade],
    ["grade_raw", row.grade_raw, existing?.grade_raw],
    ["business_number", row.business_number, existing?.business_number],
    ["website", row.website, existing?.website],
    ["ceo_name", row.ceo_name, existing?.ceo_name],
    ["address", row.address, existing?.address],
    ["region_group", row.region_group, existing?.region_group],
    ["region", row.region, existing?.region],
    ["city", row.city, existing?.city],
    ["okestro_owner", row.okestro_owner, existing?.okestro_owner ?? existing?.sales_owner],
    ["contract_contact_name", row.contract_contact_name, existing?.contract_contact_name],
    ["contract_contact_phone", row.contract_contact_phone, existing?.contract_contact_phone],
    ["contract_contact_email", row.contract_contact_email, existing?.contract_contact_email],
    ["revenue_2023", row.revenue_2023, existing?.revenue_2023],
    ["employee_count", row.employee_count, existing?.employee_count],
    ["credit_rating", row.credit_rating, existing?.credit_rating]
  ];

  return fields
    .filter(([, nextValue]) => !!nextValue)
    .filter(([, nextValue, currentValue]) => normalizeValue(nextValue) !== normalizeValue(currentValue))
    .map(([field]) => field);
}

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim();
}
