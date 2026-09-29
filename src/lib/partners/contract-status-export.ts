import type { SupabaseClient } from "@supabase/supabase-js";
import { getDisplayPartnerGradeLabel } from "@/lib/partners/grade";
import { filterSamplePartners } from "@/lib/partners/sample-filter";
import type { Partner, PartnerContact } from "@/types/partner";

export const CONTRACT_STATUS_HEADERS = [
  "No",
  "계약일자",
  "회사명",
  "등급",
  "등급(변경)",
  "오케스트로 담당자",
  "사업자번호",
  "홈페이지",
  "대표이사",
  "광역권",
  "지역",
  "시군구",
  "주소",
  "계약 담당자이름",
  "직급",
  "연락처",
  "담당자 이메일",
  "경쟁 파트너 등록 현황\n(이노그리드,레드햇 확인)",
  "2023년 매출(억)",
  "직원수(명)",
  "신용등급\n(최신)",
  "신용등급(CXMS)",
  "영업인력(명)",
  "엔지니어인력(명)",
  "스캔본",
  "등록서류",
  "파트너십 추천인(유입경로)",
  "CXMS 등록",
  "주요내용",
  "임직원보안서약서(YYMMDD)",
  "보안서약서 제출자",
  "26년 3월",
  "26년2월",
  "25년1월",
  "25년11월",
  "25년9월",
  "25년8월",
  "25년2월",
  "25년1월",
  "파트너데이2025(부산)",
  "파트너데이2025(대전)",
  "플래티넘 간담회(251218)",
  "파트너데이2026"
] as const;

export type ContractStatusExportRow = {
  partnerId: string;
  companyName: string;
  externalNo: string;
  contractDate: string;
  grade: string;
  values: string[];
};

type AnyRow = Record<string, unknown>;

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function first(...values: unknown[]): string {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return "";
}

function formatDate(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (match) return `${match[1]}.${match[2]}.${match[3]}`;
  return raw.replace(/-/g, ".");
}

function formatYyMmDd(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return "";
  return `${match[1].slice(2)}${match[2]}${match[3]}`;
}

function revenueToEok(value: unknown): string {
  const raw = clean(value);
  if (!raw || raw === "-") return raw;
  const eok = raw.match(/([\d,.]+)\s*억/);
  if (eok) {
    const parsed = Number(eok[1].replace(/,/g, ""));
    return Number.isFinite(parsed) ? String(Math.floor(parsed)) : raw;
  }
  const numberText = raw.match(/[\d,.]+/)?.[0];
  if (!numberText) return raw;
  const parsed = Number(numberText.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return raw;
  if (parsed >= 1000) return String(Math.floor(parsed / 100));
  return String(Math.floor(parsed));
}

function asRecord(value: unknown): AnyRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyRow)
    : {};
}

function toExcelGradeLabel(value: unknown, companyName: string): string {
  const raw = clean(value);
  if (!raw) return "";
  const label = getDisplayPartnerGradeLabel({ company_name: companyName, grade: raw });
  const map: Record<string, string> = {
    Silver: "실버",
    Gold: "골드",
    Platinum: "플래티넘",
    "Service Partner": "서비스 파트너"
  };
  return map[label] ?? label;
}

function inferRegion(address: string): {
  regionGroup: string;
  region: string;
  city: string;
} {
  const text = clean(address);
  if (!text) return { regionGroup: "", region: "", city: "" };

  const rules: Array<[RegExp, string, string]> = [
    [/서울/, "수도권", "서울"],
    [/경기/, "수도권", "경기"],
    [/인천/, "수도권", "인천"],
    [/부산/, "영남권", "부산"],
    [/대구/, "영남권", "대구"],
    [/울산/, "영남권", "울산"],
    [/경상남도|경남/, "영남권", "경남"],
    [/경상북도|경북/, "영남권", "경북"],
    [/대전/, "중부권", "대전"],
    [/세종/, "중부권", "세종"],
    [/충청북도|충북/, "중부권", "충북"],
    [/충청남도|충남/, "중부권", "충남"],
    [/강원/, "중부권", "강원"],
    [/광주/, "중부권", "광주"],
    [/전라북도|전북/, "중부권", "전북"],
    [/전라남도|전남/, "중부권", "전남"],
    [/제주/, "중부권", "제주"]
  ];

  let regionGroup = "";
  let region = "";
  for (const [pattern, group, label] of rules) {
    if (pattern.test(text)) {
      regionGroup = group;
      region = label;
      break;
    }
  }

  const city =
    text.match(/(?:^|\s)([가-힣]+(?:시|군|구))(?:\s|$)/)?.[1] ?? "";

  return { regionGroup, region, city };
}

function chooseContact(
  partner: AnyRow,
  contacts: PartnerContact[],
  application: AnyRow | null
): { name: string; position: string; phone: string; email: string } {
  const explicitName = clean(partner.contract_contact_name);
  const matchedByName = explicitName
    ? contacts.find((contact) => clean(contact.name) === explicitName)
    : null;
  const contact =
    matchedByName ??
    contacts.find((row) => row.is_contract_contact && row.is_active !== false && !row.deleted_at) ??
    contacts.find((row) => row.is_primary && row.is_active !== false && !row.deleted_at) ??
    contacts.find((row) => row.is_active !== false && !row.deleted_at) ??
    null;

  return {
    name: first(explicitName, contact?.name, application?.contact_name),
    position: first(contact?.position, application?.contact_position),
    phone: first(partner.contract_contact_phone, contact?.phone, application?.contact_phone),
    email: first(partner.contract_contact_email, contact?.email, application?.contact_email)
  };
}

function applicationCompany(application: AnyRow | null): AnyRow {
  const form = asRecord(application?.form_payload);
  return asRecord(form.company);
}

function applicationMajorDetails(application: AnyRow | null): string {
  if (!application) return "";
  const form = asRecord(application.form_payload);
  const strategy = first(application.sales_strategy, form.sales_strategy);
  const customers = Array.isArray(form.customers) ? form.customers : [];
  const customerSummary = customers
    .map((row) => {
      const item = asRecord(row);
      const name = clean(item.customer_name);
      const status = clean(item.proposal_status);
      if (!name) return "";
      return status ? `${name}(${status})` : name;
    })
    .filter(Boolean)
    .slice(0, 4)
    .join(", ");
  return [customerSummary, strategy].filter(Boolean).join(" / ");
}

function trainingValue(
  monthlyMap: Map<string, { attended: boolean; rawValue: string }>,
  partnerId: string,
  year: number,
  month: number
): string {
  const item = monthlyMap.get(`${partnerId}:${year}-${month}`);
  if (!item) return "";
  return item.rawValue || (item.attended ? "O" : "");
}

export async function fetchContractStatusExportIndexRows(
  supabase: SupabaseClient
): Promise<ContractStatusExportRow[]> {
  const { data, error } = await supabase
    .from("partners")
    .select("id, external_no, company_name, contract_start_date, grade, grade_override, grade_original, grade_change_raw, deleted_at, is_active")
    .is("deleted_at", null)
    .or("is_active.is.null,is_active.eq.true")
    .limit(5000);

  if (error) throw new Error(error.message);

  const partners = filterSamplePartners((data ?? []) as unknown as Partner[]);
  return partners
    .map((partner) => ({
      partnerId: partner.id,
      companyName: clean(partner.company_name),
      externalNo: clean(partner.external_no),
      contractDate: formatDate(partner.contract_start_date),
      grade: toExcelGradeLabel(
        first(partner.grade_override, partner.grade_change_raw, partner.grade, partner.grade_original),
        clean(partner.company_name)
      ),
      values: []
    }))
    .sort((a, b) => {
      const aNo = Number(a.externalNo.replace(/\D/g, "")) || 0;
      const bNo = Number(b.externalNo.replace(/\D/g, "")) || 0;
      return bNo - aNo || a.companyName.localeCompare(b.companyName, "ko");
    });
}

export async function fetchContractStatusExportRows(
  supabase: SupabaseClient,
  partnerId?: string
): Promise<ContractStatusExportRow[]> {
  let partnerQuery = supabase
    .from("partners")
    .select(
      "id, external_no, company_name, business_number, grade, grade_override, grade_original, grade_change_raw, ceo_name, address, website, contract_start_date, sales_owner, okestro_owner, contract_contact_name, contract_contact_phone, contract_contact_email, revenue_2023, employee_count, credit_rating, region_group, region, city, memo, dedicated_sales_count, dedicated_engineer_count, deleted_at, is_active"
    )
    .is("deleted_at", null)
    .or("is_active.is.null,is_active.eq.true");

  if (partnerId) {
    partnerQuery = partnerQuery.eq("id", partnerId);
  }

  const { data: partnerData, error: partnerError } = await partnerQuery.limit(partnerId ? 1 : 5000);

  if (partnerError) throw new Error(partnerError.message);

  const partners = filterSamplePartners((partnerData ?? []) as unknown as Partner[]);
  const partnerIds = partners.map((partner) => partner.id);
  if (partnerIds.length === 0) return [];

  const [contactsRes, applicationsRes, documentsRes, monthlyRes] = await Promise.all([
    supabase
      .from("partner_contacts")
      .select(
        "id, partner_id, name, department, position, email, phone, is_primary, is_contract_contact, is_active, deleted_at, created_at"
      )
      .in("partner_id", partnerIds)
      .is("deleted_at", null)
      .limit(10000),
    supabase
      .from("partner_applications")
      .select(
        "approved_partner_id, contact_name, contact_position, contact_phone, contact_email, business_registration_number, representative_name, address, website, credit_grade, revenue, total_employees, dedicated_sales_count, dedicated_technical_count, sales_strategy, form_payload, updated_at"
      )
      .not("approved_partner_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(5000),
    supabase
      .from("partner_documents")
      .select("partner_id, document_type, received_date, created_at, is_active, deleted_at")
      .in("partner_id", partnerIds)
      .is("deleted_at", null)
      .limit(10000),
    supabase
      .from("training_attendance")
      .select("partner_id, attended, raw_value, training:trainings(training_year, training_month, start_date)")
      .in("partner_id", partnerIds)
      .is("deleted_at", null)
      .limit(10000)
  ]);

  if (contactsRes.error) throw new Error(contactsRes.error.message);
  if (applicationsRes.error) throw new Error(applicationsRes.error.message);
  if (documentsRes.error) throw new Error(documentsRes.error.message);
  if (monthlyRes.error) throw new Error(monthlyRes.error.message);

  const contactsByPartner = new Map<string, PartnerContact[]>();
  for (const raw of contactsRes.data ?? []) {
    const contact = raw as unknown as PartnerContact;
    const list = contactsByPartner.get(contact.partner_id) ?? [];
    list.push(contact);
    contactsByPartner.set(contact.partner_id, list);
  }

  const applicationsByPartner = new Map<string, AnyRow>();
  for (const raw of applicationsRes.data ?? []) {
    const row = raw as AnyRow;
    const partnerId = clean(row.approved_partner_id);
    if (partnerId && !applicationsByPartner.has(partnerId)) {
      applicationsByPartner.set(partnerId, row);
    }
  }

  const docsByPartner = new Map<
    string,
    { contract: boolean; registration: boolean; businessRegistration: boolean; securityDate: string }
  >();
  for (const raw of documentsRes.data ?? []) {
    const row = raw as AnyRow;
    if (row.is_active === false) continue;
    const partnerId = clean(row.partner_id);
    if (!partnerId) continue;
    const current = docsByPartner.get(partnerId) ?? {
      contract: false,
      registration: false,
      businessRegistration: false,
      securityDate: ""
    };
    const type = clean(row.document_type);
    if (type === "partner_contract" || type === "platinum_agreement") {
      current.contract = true;
    }
    if (type === "business_registration") {
      current.businessRegistration = true;
    }
    if (
      type === "partner_application" ||
      type === "business_registration" ||
      type === "company_profile" ||
      type === "credit_rating"
    ) {
      current.registration = true;
    }
    if (type === "security_commitment") {
      const date = first(row.received_date, row.created_at);
      if (date && (!current.securityDate || date > current.securityDate)) {
        current.securityDate = date;
      }
    }
    docsByPartner.set(partnerId, current);
  }

  const monthlyMap = new Map<string, { attended: boolean; rawValue: string }>();
  for (const raw of monthlyRes.data ?? []) {
    const row = raw as AnyRow;
    const partnerId = clean(row.partner_id);
    const trainingRaw = row.training;
    const training = Array.isArray(trainingRaw)
      ? asRecord(trainingRaw[0])
      : asRecord(trainingRaw);
    const startDate = clean(training.start_date);
    const year =
      Number(training.training_year) ||
      Number(startDate.match(/^(\d{4})/)?.[1] ?? NaN);
    const month =
      Number(training.training_month) ||
      Number(startDate.match(/^\d{4}-(\d{2})/)?.[1] ?? NaN);

    if (!partnerId || !Number.isFinite(year) || !Number.isFinite(month)) continue;

    const key = `${partnerId}:${year}-${month}`;
    const existing = monthlyMap.get(key);
    const rawValue = clean(row.raw_value);
    const attended = row.attended === true;

    if (!existing) {
      monthlyMap.set(key, { attended, rawValue });
      continue;
    }

    monthlyMap.set(key, {
      attended: existing.attended || attended,
      rawValue: existing.rawValue || rawValue
    });
  }

  const rows = partners.map((partner) => {
    const p = partner as unknown as AnyRow;
    const partnerId = partner.id;
    const application = applicationsByPartner.get(partnerId) ?? null;
    const appCompany = applicationCompany(application);
    const contacts = contactsByPartner.get(partnerId) ?? [];
    const contact = chooseContact(p, contacts, application);
    const address = first(p.address, application?.address, appCompany.address);
    const inferred = inferRegion(address);
    const companyName = clean(p.company_name);
    const originalGrade = toExcelGradeLabel(first(p.grade_original, p.grade), companyName);
    const effectiveGrade = toExcelGradeLabel(
      first(p.grade_override, p.grade_change_raw, p.grade, p.grade_original),
      companyName
    );
    const gradeChange = first(p.grade_change_raw, effectiveGrade, originalGrade);
    const docs = docsByPartner.get(partnerId) ?? {
      contract: false,
      registration: false,
      businessRegistration: false,
      securityDate: ""
    };

    const values = [
      clean(p.external_no),
      formatDate(p.contract_start_date),
      companyName,
      originalGrade || effectiveGrade,
      gradeChange,
      first(p.okestro_owner, p.sales_owner),
      first(p.business_number, application?.business_registration_number, appCompany.business_registration_number),
      first(p.website, application?.website, appCompany.website),
      first(p.ceo_name, application?.representative_name, appCompany.representative_name),
      first(p.region_group, inferred.regionGroup),
      first(p.region, inferred.region),
      first(p.city, inferred.city),
      address,
      contact.name,
      contact.position,
      contact.phone,
      contact.email,
      "",
      revenueToEok(first(p.revenue_2023, application?.revenue, appCompany.revenue)),
      first(p.employee_count, application?.total_employees, appCompany.total_employees),
      first(p.credit_rating, application?.credit_grade, appCompany.credit_grade),
      "",
      first(p.dedicated_sales_count, application?.dedicated_sales_count, appCompany.dedicated_sales_count),
      first(p.dedicated_engineer_count, application?.dedicated_technical_count, appCompany.dedicated_technical_count),
      docs.contract ? "완료" : "",
      docs.registration ? "O" : "",
      "",
      [
        docs.businessRegistration ? "사업자등록증" : "",
        docs.contract ? "파트너계약서" : ""
      ]
        .filter(Boolean)
        .join("/"),
      first(p.memo, applicationMajorDetails(application)),
      formatYyMmDd(docs.securityDate),
      "",
      trainingValue(monthlyMap, partnerId, 2026, 3),
      trainingValue(monthlyMap, partnerId, 2026, 2),
      trainingValue(monthlyMap, partnerId, 2025, 1),
      trainingValue(monthlyMap, partnerId, 2025, 11),
      trainingValue(monthlyMap, partnerId, 2025, 9),
      trainingValue(monthlyMap, partnerId, 2025, 8),
      trainingValue(monthlyMap, partnerId, 2025, 2),
      trainingValue(monthlyMap, partnerId, 2025, 1),
      "",
      "",
      "",
      ""
    ].map(clean);

    if (values.length !== CONTRACT_STATUS_HEADERS.length) {
      throw new Error("계약현황 추출 열 개수가 원본 엑셀과 일치하지 않습니다.");
    }

    return {
      partnerId,
      companyName,
      externalNo: clean(p.external_no),
      contractDate: formatDate(p.contract_start_date),
      grade: effectiveGrade,
      values
    };
  });

  rows.sort((a, b) => {
    const aNo = Number(a.externalNo.replace(/\D/g, "")) || 0;
    const bNo = Number(b.externalNo.replace(/\D/g, "")) || 0;
    return bNo - aNo || a.companyName.localeCompare(b.companyName, "ko");
  });

  return rows;
}
