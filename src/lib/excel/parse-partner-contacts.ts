import * as XLSX from "xlsx";
import { normalizeCompanyName } from "@/lib/partner-match";

export const PARTNER_CONTACTS_SOURCE_FILE = "파트너 전체 DB.xlsx";

export type PartnerContactRoleType =
  | "sales"
  | "engineer"
  | "admin"
  | "executive"
  | "contract"
  | "etc";

export type ParsedPartnerContactRow = {
  row_number: number;
  excluded: boolean;
  excluded_reason: string | null;
  company_name: string;
  normalized_company_name: string | null;
  contact_name: string;
  role_raw: string | null;
  role_type: PartnerContactRoleType;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  is_contract_contact: boolean;
  source_file: string;
  warnings: string[];
};

export type PartnerContactsParseResult = {
  sheet_name: string;
  total_rows: number;
  excluded_count: number;
  warning_count: number;
  rows: ParsedPartnerContactRow[];
  headers: string[];
};

export function parsePartnerContactsWorkbook(
  workbook: XLSX.WorkBook
): PartnerContactsParseResult {
  const sheetName = pickTargetSheet(workbook.SheetNames);
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

function pickTargetSheet(sheetNames: string[]): string {
  if (sheetNames.length === 0) {
    throw new Error("업로드 파일에 시트가 없습니다.");
  }

  const exact = sheetNames.find((name) => normalizeSheetName(name) === "파트너db");
  if (exact) return exact;

  const similar = sheetNames.find((name) => {
    const normalized = normalizeSheetName(name);
    return normalized.includes("파트너") && normalized.includes("db");
  });
  if (similar) return similar;

  return sheetNames[0];
}

function normalizeSheetName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

function parseRow(row: Record<string, unknown>, index: number): ParsedPartnerContactRow {
  const warnings: string[] = [];
  const company_name = pickString(row, ["회사명", "업체명", "파트너사", "파트너사명"]);
  const contact_name = pickString(row, [
    "계약 담당자이름",
    "계약 담당자 이름",
    "담당자이름",
    "담당자 이름",
    "이름",
    "성명"
  ]);

  if (!company_name) {
    return excludedRow(index, "회사명이 없습니다.");
  }

  if (!contact_name) {
    return excludedRow(index, "담당자 이름이 없습니다.", company_name);
  }

  const role_raw = normalizeEmpty(
    pickString(row, ["담당 업무", "담당업무", "업무", "구분", "역할"])
  );
  const email = normalizeEmail(
    normalizeEmpty(
      pickString(row, ["담당자 이메일", "담당자이메일", "이메일", "메일", "email", "Email"])
    ),
    warnings
  );
  const contractFlag = normalizeBooleanFlag(
    pickRaw(row, ["계약담당자", "계약 담당자 여부", "계약 담당자", "계약여부"])
  );
  const role_type = inferRoleType(role_raw);
  const is_contract_contact = contractFlag || role_type === "contract";

  return {
    row_number: index + 1,
    excluded: false,
    excluded_reason: null,
    company_name,
    normalized_company_name: normalizeCompanyName(company_name),
    contact_name,
    role_raw,
    role_type,
    department: normalizeEmpty(pickString(row, ["부서", "소속부서", "담당 부서"])),
    position: normalizeEmpty(pickString(row, ["직급", "직위"])),
    phone: normalizeEmpty(pickString(row, ["연락처", "전화번호", "휴대폰", "전화", "핸드폰"])),
    email,
    is_contract_contact,
    source_file: PARTNER_CONTACTS_SOURCE_FILE,
    warnings
  };
}

function excludedRow(
  index: number,
  reason: string,
  company_name = ""
): ParsedPartnerContactRow {
  return {
    row_number: index + 1,
    excluded: true,
    excluded_reason: reason,
    company_name,
    normalized_company_name: company_name ? normalizeCompanyName(company_name) : null,
    contact_name: "",
    role_raw: null,
    role_type: "etc",
    department: null,
    position: null,
    phone: null,
    email: null,
    is_contract_contact: false,
    source_file: PARTNER_CONTACTS_SOURCE_FILE,
    warnings: []
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

function normalizeEmail(value: string | null, warnings: string[]): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (!valid) {
    warnings.push(`이메일 형식 확인 필요: "${trimmed}"`);
  }
  return trimmed;
}

function normalizeBooleanFlag(value: unknown): boolean {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return ["o", "y", "yes", "예", "true", "1"].includes(normalized);
}

export function inferRoleType(value: string | null): PartnerContactRoleType {
  if (!value) return "etc";
  const normalized = value.toLowerCase();

  if (normalized.includes("대표이사") || normalized.includes("대표") || normalized.includes("ceo")) {
    return "executive";
  }
  if (normalized.includes("계약")) return "contract";
  if (
    normalized.includes("기술") ||
    normalized.includes("엔지니어") ||
    normalized.includes("engineering") ||
    normalized.includes("engineer") ||
    normalized.includes("se")
  ) {
    return "engineer";
  }
  if (normalized.includes("영업") || normalized.includes("sales")) return "sales";
  if (
    normalized.includes("관리") ||
    normalized.includes("지원") ||
    normalized.includes("총무") ||
    normalized.includes("마케팅") ||
    normalized.includes("admin")
  ) {
    return "admin";
  }
  return "etc";
}
