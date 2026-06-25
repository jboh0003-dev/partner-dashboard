import * as XLSX from "xlsx";
import { normalizeGrade, parseContractDate } from "@/lib/excel/parse-partner-contracts";
import { normalizeBusinessNumber, normalizeCompanyName } from "@/lib/partner-match";

export const PARTNER_MASTER_SOURCE_FILE = "파트너관리.xlsx";

export type ParsedPartnerMasterRow = {
  row_number: number;
  excluded: boolean;
  excluded_reason: string | null;
  company_name: string;
  normalized_company_name: string | null;
  business_number: string | null;
  normalized_business_number: string | null;
  external_no: string | null;
  contract_start_date: string | null;
  grade: string | null;
  grade_raw: string | null;
  website: string | null;
  ceo_name: string | null;
  address: string | null;
  region_group: string | null;
  region: string | null;
  city: string | null;
  okestro_owner: string | null;
  contract_contact_name: string | null;
  contract_contact_phone: string | null;
  contract_contact_email: string | null;
  revenue_2023: string | null;
  employee_count: string | null;
  credit_rating: string | null;
  source_file: string;
  warnings: string[];
};

export type PartnerMasterParseResult = {
  sheet_name: string;
  total_rows: number;
  excluded_count: number;
  warning_count: number;
  rows: ParsedPartnerMasterRow[];
  headers: string[];
};

export function parsePartnerMasterWorkbook(
  workbook: XLSX.WorkBook
): PartnerMasterParseResult {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true
  });

  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  const rows = json.map((row, index) => parseRow(row, index));

  return {
    sheet_name: sheetName,
    total_rows: rows.length,
    excluded_count: rows.filter((row) => row.excluded).length,
    warning_count: rows.filter((row) => !row.excluded && row.warnings.length > 0).length,
    rows,
    headers
  };
}

function parseRow(row: Record<string, unknown>, index: number): ParsedPartnerMasterRow {
  const warnings: string[] = [];
  const company_name = pickString(row, ["회사명", "업체명", "파트너사", "파트너사명"]);

  if (!company_name) {
    return {
      row_number: index + 1,
      excluded: true,
      excluded_reason: "회사명 없음",
      company_name: "",
      normalized_company_name: null,
      business_number: null,
      normalized_business_number: null,
      external_no: null,
      contract_start_date: null,
      grade: null,
      grade_raw: null,
      website: null,
      ceo_name: null,
      address: null,
      region_group: null,
      region: null,
      city: null,
      okestro_owner: null,
      contract_contact_name: null,
      contract_contact_phone: null,
      contract_contact_email: null,
      revenue_2023: null,
      employee_count: null,
      credit_rating: null,
      source_file: PARTNER_MASTER_SOURCE_FILE,
      warnings
    };
  }

  const business_number = normalizeEmpty(
    pickString(row, ["사업자번호", "사업자 등록번호", "사업자등록번호"])
  );
  const contractDate = parseContractDate(
    pickRaw(row, ["계약일자", "계약일", "계약 시작일", "계약시작일"])
  );
  if (contractDate.warning) warnings.push(contractDate.warning);

  const gradeRaw = normalizeEmpty(
    pickString(row, ["등급 변경", "등급변경", "등급 원문", "등급"])
  );
  const contractEmail = normalizeEmail(
    normalizeEmpty(
      pickString(row, ["계약 담당자 이메일", "계약담당자 이메일", "계약담당자 메일", "계약 담당자 메일"])
    ),
    warnings
  );

  return {
    row_number: index + 1,
    excluded: false,
    excluded_reason: null,
    company_name,
    normalized_company_name: normalizeCompanyName(company_name),
    business_number,
    normalized_business_number: normalizeBusinessNumber(business_number),
    external_no: normalizeEmpty(
      pickString(row, ["번호", "No", "NO", "파트너번호"])
    ),
    contract_start_date: contractDate.iso,
    grade: gradeRaw ? normalizeGrade(gradeRaw) : null,
    grade_raw: gradeRaw,
    website: normalizeEmpty(pickString(row, ["홈페이지", "웹사이트", "website", "URL"])),
    ceo_name: normalizeEmpty(pickString(row, ["대표이사", "대표자", "대표"])),
    address: normalizeEmpty(pickString(row, ["주소", "본사 주소"])),
    region_group: normalizeEmpty(pickString(row, ["광역권", "권역"])),
    region: normalizeEmpty(pickString(row, ["지역"])),
    city: normalizeEmpty(pickString(row, ["시군구", "도시"])),
    okestro_owner: normalizeEmpty(
      pickString(row, ["오케스트로 담당자", "오케스트로담당자", "영업담당자"])
    ),
    contract_contact_name: normalizeEmpty(
      pickString(row, ["계약 담당자 이름", "계약담당자 이름", "계약 담당자", "계약담당자"])
    ),
    contract_contact_phone: normalizeEmpty(
      pickString(row, ["계약 담당자 연락처", "계약담당자 연락처", "계약 담당자 전화", "계약담당자 전화"])
    ),
    contract_contact_email: contractEmail,
    revenue_2023: normalizeEmpty(
      pickString(row, ["2023년 매출", "23년 매출", "매출", "매출액"])
    ),
    employee_count: normalizeEmpty(pickString(row, ["직원수", "임직원수"])),
    credit_rating: normalizeEmpty(pickString(row, ["신용등급"])),
    source_file: PARTNER_MASTER_SOURCE_FILE,
    warnings
  };
}

function pickRaw(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row) return row[key];
  }
  return undefined;
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  const value = pickRaw(row, keys);
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalizeEmpty(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(
  value: string | null,
  warnings: string[]
): string | null {
  if (!value) return null;
  const email = value.trim();
  if (!email) return null;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) {
    warnings.push(`이메일 형식 확인 필요: "${email}"`);
  }
  return email;
}
