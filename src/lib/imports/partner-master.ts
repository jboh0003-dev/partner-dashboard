import type { ParsedPartnerMasterRow } from "@/lib/excel/parse-partner-master";
import {
  getExactCompanyNameKey,
  normalizeBusinessNumber,
  normalizeCompanyName,
  normalizePartnerNo
} from "@/lib/partner-match";

export type PartnerMasterUploadMode = "update" | "full_sync";

export type PartnerMasterDbRow = {
  id: string;
  company_name: string;
  business_number: string | null;
  external_no?: string | null;
  contract_start_date?: string | null;
  grade?: string | null;
  grade_original?: string | null;
  grade_change_raw?: string | null;
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
  edited_via_dashboard_at?: string | null;
  deleted_at?: string | null;
  is_active?: boolean | null;
};

export type PartnerMasterAnalysisAction = "create" | "update" | "skip" | "review";

export type PartnerMasterAnalysisItem = {
  row_number: number;
  company_name: string;
  business_number: string | null;
  external_no: string | null;
  action: PartnerMasterAnalysisAction;
  reason: string;
  changed_fields: string[];
  matched_partner_id: string | null;
  warnings?: string[];
};

export type PartnerMasterMissingItem = {
  partner_id: string;
  company_name: string;
  external_no: string | null;
  business_number: string | null;
};

export type PartnerMasterAnalysisSummary = {
  total: number;
  create: number;
  update: number;
  skip: number;
  review: number;
  missing_from_excel: number;
  errors: number;
};

export function filterActivePartnerMasterRows(
  partners: PartnerMasterDbRow[]
): PartnerMasterDbRow[] {
  return partners.filter(
    (partner) => !partner.deleted_at && partner.is_active !== false
  );
}

export function analyzePartnerMasterRows(
  rows: ParsedPartnerMasterRow[],
  existingPartners: PartnerMasterDbRow[],
  options?: { uploadMode?: PartnerMasterUploadMode }
): {
  items: PartnerMasterAnalysisItem[];
  summary: PartnerMasterAnalysisSummary;
  missingFromExcel: PartnerMasterMissingItem[];
} {
  const activePartners = filterActivePartnerMasterRows(existingPartners);
  const byPartnerNo = new Map<string, PartnerMasterDbRow[]>();
  const byBusinessNumber = new Map<string, PartnerMasterDbRow[]>();
  const byExactName = new Map<string, PartnerMasterDbRow[]>();
  const byNormalizedName = new Map<string, PartnerMasterDbRow[]>();

  for (const partner of activePartners) {
    const partnerNo = normalizePartnerNo(partner.external_no);
    if (partnerNo) {
      const list = byPartnerNo.get(partnerNo) ?? [];
      list.push(partner);
      byPartnerNo.set(partnerNo, list);
    }

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

  const items = rows.map((row) =>
    analyzeRow(row, byPartnerNo, byBusinessNumber, byExactName, byNormalizedName)
  );

  const summary = items.reduce<PartnerMasterAnalysisSummary>(
    (acc, item) => {
      acc.total += 1;
      acc[item.action] += 1;
      return acc;
    },
    { total: 0, create: 0, update: 0, skip: 0, review: 0, missing_from_excel: 0, errors: 0 }
  );

  const missingFromExcel =
    options?.uploadMode === "full_sync"
      ? findPartnersMissingFromExcel(items, activePartners)
      : [];

  summary.missing_from_excel = missingFromExcel.length;

  return { items, summary, missingFromExcel };
}

export function findPartnersMissingFromExcel(
  items: PartnerMasterAnalysisItem[],
  activePartners: PartnerMasterDbRow[]
): PartnerMasterMissingItem[] {
  const matchedIds = new Set(
    items
      .map((item) => item.matched_partner_id)
      .filter((id): id is string => Boolean(id))
  );

  return activePartners
    .filter((partner) => !matchedIds.has(partner.id))
    .map((partner) => ({
      partner_id: partner.id,
      company_name: partner.company_name,
      external_no: partner.external_no ?? null,
      business_number: partner.business_number ?? null
    }));
}

function analyzeRow(
  row: ParsedPartnerMasterRow,
  byPartnerNo: Map<string, PartnerMasterDbRow[]>,
  byBusinessNumber: Map<string, PartnerMasterDbRow[]>,
  byExactName: Map<string, PartnerMasterDbRow[]>,
  byNormalizedName: Map<string, PartnerMasterDbRow[]>
): PartnerMasterAnalysisItem {
  const base = {
    row_number: row.row_number,
    company_name: row.company_name,
    business_number: row.business_number,
    external_no: row.external_no
  };

  if (row.excluded) {
    return {
      ...base,
      action: "skip",
      reason: row.excluded_reason ?? "제외",
      changed_fields: [],
      matched_partner_id: null
    };
  }

  const partnerNoKey = row.external_no ? normalizePartnerNo(row.external_no) : null;
  const partnerNoMatches = partnerNoKey ? byPartnerNo.get(partnerNoKey) ?? [] : [];
  const businessMatches = row.normalized_business_number
    ? byBusinessNumber.get(row.normalized_business_number) ?? []
    : [];
  const exactNameMatches = row.company_name
    ? byExactName.get(getExactCompanyNameKey(row.company_name) ?? "") ?? []
    : [];
  const normalizedNameMatches = row.normalized_company_name
    ? byNormalizedName.get(row.normalized_company_name) ?? []
    : [];

  if (partnerNoKey && partnerNoMatches.length > 1) {
    return reviewItem(base, "파트너번호로 여러 파트너가 조회됩니다.");
  }
  if (row.normalized_business_number && businessMatches.length > 1) {
    return reviewItem(base, "사업자번호로 여러 파트너가 조회됩니다.");
  }
  if (exactNameMatches.length > 1) {
    return reviewItem(base, "회사명 원문 완전일치 결과가 여러 건입니다.");
  }
  if (
    !row.normalized_business_number &&
    exactNameMatches.length === 0 &&
    normalizedNameMatches.length > 1
  ) {
    return reviewItem(base, "정규화 회사명 후보가 여러 건입니다.");
  }

  let matchedPartner: PartnerMasterDbRow | null = null;
  let matchReason = "";

  if (partnerNoMatches.length === 1) {
    matchedPartner = partnerNoMatches[0];
    matchReason = "파트너번호 매칭";
  } else if (businessMatches.length === 1) {
    matchedPartner = businessMatches[0];
    matchReason = "사업자번호 매칭";
  } else if (normalizedNameMatches.length === 1) {
    matchedPartner = normalizedNameMatches[0];
    matchReason = "회사명 정규화 매칭";
  } else if (exactNameMatches.length === 1) {
    matchedPartner = exactNameMatches[0];
    matchReason = "회사명 원문 완전일치";
  }

  if (
    matchedPartner &&
    partnerNoKey &&
    partnerNoMatches.length === 0 &&
    matchedPartner.external_no
  ) {
    const existingNo = normalizePartnerNo(matchedPartner.external_no);
    if (existingNo && existingNo !== partnerNoKey) {
      return reviewItem(base, "파트너번호가 기존 데이터와 다릅니다.");
    }
  }

  if (
    matchedPartner &&
    row.normalized_business_number &&
    businessMatches.length === 0 &&
    matchedPartner.business_number
  ) {
    const existingBn = normalizeBusinessNumber(matchedPartner.business_number);
    if (existingBn && existingBn !== row.normalized_business_number) {
      return reviewItem(base, "사업자번호가 기존 데이터와 다릅니다.");
    }
  }

  if (!matchedPartner) {
    if (partnerNoKey && partnerNoMatches.length > 0) {
      return reviewItem(base, "파트너번호가 이미 존재합니다.");
    }
    if (row.normalized_business_number && businessMatches.length > 0) {
      return reviewItem(base, "사업자번호가 이미 존재합니다. 신규 생성할 수 없습니다.");
    }
    if (normalizedNameMatches.length > 1 || exactNameMatches.length > 1) {
      return reviewItem(base, "회사명 후보가 여러 건입니다.");
    }

    return {
      ...base,
      action: "create",
      reason: "신규 파트너 생성",
      changed_fields: getChangedFields(row, null),
      matched_partner_id: null
    };
  }

  const changedFields = getChangedFields(row, matchedPartner);
  const warnings =
    matchedPartner.edited_via_dashboard_at && changedFields.length > 0
      ? ["대시보드에서 수동 수정된 파트너입니다. 엑셀 업로드 시 변경 필드가 덮어쓰일 수 있습니다."]
      : [];

  return {
    ...base,
    action: changedFields.length > 0 ? "update" : "skip",
    reason: changedFields.length > 0 ? matchReason : `${matchReason} (변경 없음)`,
    changed_fields: changedFields,
    matched_partner_id: matchedPartner.id,
    warnings
  };
}

function reviewItem(
  base: Pick<
    PartnerMasterAnalysisItem,
    "row_number" | "company_name" | "business_number" | "external_no"
  >,
  reason: string
): PartnerMasterAnalysisItem {
  return {
    ...base,
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
    ["grade_original", row.grade_original, existing?.grade_original],
    ["grade_change_raw", row.grade_change_raw, existing?.grade_change_raw],
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

export const PARTNER_MASTER_ACTION_LABEL: Record<PartnerMasterAnalysisAction, string> = {
  create: "신규 추가",
  update: "기존 갱신",
  skip: "변경 없음",
  review: "중복 의심"
};
