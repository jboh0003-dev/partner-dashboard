import type { ParsedPartnerContactRow } from "@/lib/excel/parse-partner-contacts";
import { getExactCompanyNameKey, normalizeCompanyName } from "@/lib/partner-match";

export type PartnerContactsPartnerRow = {
  id: string;
  company_name: string;
};

export type PartnerContactsDbRow = {
  id: string;
  partner_id: string;
  name: string;
  department: string | null;
  position: string | null;
  role_type: string | null;
  role_raw: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_contract_contact: boolean;
};

export type PartnerContactsAnalysisAction = "create" | "update" | "skip" | "review";

export type PartnerContactsAnalysisItem = {
  row_number: number;
  company_name: string;
  contact_name: string;
  role_raw: string | null;
  role_type: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  action: PartnerContactsAnalysisAction;
  reason: string;
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  matched_contact_id: string | null;
};

export type PartnerContactsAnalysisSummary = {
  total: number;
  matched_partners: number;
  create: number;
  update: number;
  skip: number;
  review: number;
};

export function analyzePartnerContactRows(
  rows: ParsedPartnerContactRow[],
  partners: PartnerContactsPartnerRow[],
  contacts: PartnerContactsDbRow[]
): {
  items: PartnerContactsAnalysisItem[];
  summary: PartnerContactsAnalysisSummary;
} {
  const partnersByExactName = new Map<string, PartnerContactsPartnerRow[]>();
  const partnersByNormalizedName = new Map<string, PartnerContactsPartnerRow[]>();
  const contactsByPartner = new Map<string, PartnerContactsDbRow[]>();

  for (const partner of partners) {
    const exact = getExactCompanyNameKey(partner.company_name);
    if (exact) {
      const list = partnersByExactName.get(exact) ?? [];
      list.push(partner);
      partnersByExactName.set(exact, list);
    }

    const normalized = normalizeCompanyName(partner.company_name);
    if (normalized) {
      const list = partnersByNormalizedName.get(normalized) ?? [];
      list.push(partner);
      partnersByNormalizedName.set(normalized, list);
    }
  }

  for (const contact of contacts) {
    const list = contactsByPartner.get(contact.partner_id) ?? [];
    list.push(contact);
    contactsByPartner.set(contact.partner_id, list);
  }

  const items = rows.map((row) =>
    analyzeRow(row, partnersByExactName, partnersByNormalizedName, contactsByPartner)
  );

  const summary = items.reduce<PartnerContactsAnalysisSummary>(
    (acc, item) => {
      acc.total += 1;
      if (item.matched_partner_id) acc.matched_partners += 1;
      acc[item.action] += 1;
      return acc;
    },
    { total: 0, matched_partners: 0, create: 0, update: 0, skip: 0, review: 0 }
  );

  return { items, summary };
}

function analyzeRow(
  row: ParsedPartnerContactRow,
  partnersByExactName: Map<string, PartnerContactsPartnerRow[]>,
  partnersByNormalizedName: Map<string, PartnerContactsPartnerRow[]>,
  contactsByPartner: Map<string, PartnerContactsDbRow[]>
): PartnerContactsAnalysisItem {
  if (row.excluded) {
    return {
      row_number: row.row_number,
      company_name: row.company_name,
      contact_name: row.contact_name,
      role_raw: row.role_raw,
      role_type: row.role_type,
      department: row.department,
      position: row.position,
      phone: row.phone,
      email: row.email,
      action: "skip",
      reason: row.excluded_reason ?? "제외",
      matched_partner_id: null,
      matched_partner_name: null,
      matched_contact_id: null
    };
  }

  const exactMatches = row.company_name
    ? partnersByExactName.get(getExactCompanyNameKey(row.company_name) ?? "") ?? []
    : [];
  const normalizedMatches = row.normalized_company_name
    ? partnersByNormalizedName.get(row.normalized_company_name) ?? []
    : [];

  if (exactMatches.length > 1) {
    return reviewItem(row, "회사명 원문 완전일치 결과가 여러 건입니다.");
  }

  if (exactMatches.length === 0 && normalizedMatches.length === 0) {
    return reviewItem(row, "매칭되는 파트너가 없습니다.");
  }

  if (exactMatches.length === 0 && normalizedMatches.length > 1) {
    return reviewItem(row, "정규화 회사명 후보가 여러 건입니다.");
  }

  const matchedPartner = exactMatches[0] ?? normalizedMatches[0];
  if (!matchedPartner) {
    return reviewItem(row, "매칭되는 파트너가 없습니다.");
  }

  const partnerContacts = contactsByPartner.get(matchedPartner.id) ?? [];

  const emailMatches = row.email
    ? partnerContacts.filter((contact) => normalizeValue(contact.email) === normalizeValue(row.email))
    : [];
  if (emailMatches.length > 1) {
    return reviewItem(row, "같은 이메일을 가진 담당자가 여러 명입니다.", matchedPartner);
  }
  if (emailMatches.length === 1) {
    return updateItem(row, matchedPartner, emailMatches[0], "이메일 기준 매칭");
  }

  const phoneMatches =
    !row.email && row.phone
      ? partnerContacts.filter((contact) => normalizeValue(contact.phone) === normalizeValue(row.phone))
      : [];
  if (phoneMatches.length > 1) {
    return reviewItem(row, "같은 연락처를 가진 담당자가 여러 명입니다.", matchedPartner);
  }
  if (phoneMatches.length === 1) {
    return updateItem(row, matchedPartner, phoneMatches[0], "연락처 기준 매칭");
  }

  const nameDepartmentMatches =
    !row.email && !row.phone
      ? partnerContacts.filter(
          (contact) =>
            normalizeValue(contact.name) === normalizeValue(row.contact_name) &&
            normalizeValue(contact.department) === normalizeValue(row.department)
        )
      : [];

  if (nameDepartmentMatches.length > 1) {
    return reviewItem(row, "이름/부서 기준으로 여러 담당자가 조회됩니다.", matchedPartner);
  }
  if (nameDepartmentMatches.length === 1) {
    return updateItem(row, matchedPartner, nameDepartmentMatches[0], "이름/부서 기준 매칭");
  }

  return {
    row_number: row.row_number,
    company_name: row.company_name,
    contact_name: row.contact_name,
    role_raw: row.role_raw,
    role_type: row.role_type,
    department: row.department,
    position: row.position,
    phone: row.phone,
    email: row.email,
    action: "create",
    reason: exactMatches.length === 1 ? "신규 담당자 생성" : "정규화 후보 기준 신규 담당자 생성",
    matched_partner_id: matchedPartner.id,
    matched_partner_name: matchedPartner.company_name,
    matched_contact_id: null
  };
}

function updateItem(
  row: ParsedPartnerContactRow,
  partner: PartnerContactsPartnerRow,
  contact: PartnerContactsDbRow,
  reason: string
): PartnerContactsAnalysisItem {
  return {
    row_number: row.row_number,
    company_name: row.company_name,
    contact_name: row.contact_name,
    role_raw: row.role_raw,
    role_type: row.role_type,
    department: row.department,
    position: row.position,
    phone: row.phone,
    email: row.email,
    action: "update",
    reason,
    matched_partner_id: partner.id,
    matched_partner_name: partner.company_name,
    matched_contact_id: contact.id
  };
}

function reviewItem(
  row: ParsedPartnerContactRow,
  reason: string,
  partner?: PartnerContactsPartnerRow
): PartnerContactsAnalysisItem {
  return {
    row_number: row.row_number,
    company_name: row.company_name,
    contact_name: row.contact_name,
    role_raw: row.role_raw,
    role_type: row.role_type,
    department: row.department,
    position: row.position,
    phone: row.phone,
    email: row.email,
    action: "review",
    reason,
    matched_partner_id: partner?.id ?? null,
    matched_partner_name: partner?.company_name ?? null,
    matched_contact_id: null
  };
}

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
