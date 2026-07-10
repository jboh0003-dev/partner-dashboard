import * as XLSX from "xlsx";
import { normalizeCompanyName, normalizePartnerNo } from "@/lib/partner-match";
import { normalizePartnerGrade } from "@/lib/partners/grade";
import { normalizePhoneInput, parsePhoneFromCell } from "@/lib/contacts/phone-normalize";

export const PARTNER_CONTACTS_SOURCE_FILE = "파트너 전체 DB.xlsx";

export type PartnerContactRoleType =
  | "sales"
  | "engineer"
  | "admin"
  | "executive"
  | "contract"
  | "etc";

/** 담당자 이름 컬럼 — 계약담당자(O 플래그) 컬럼은 절대 포함하지 않음 */
const CONTACT_NAME_COLUMN_KEYS = [
  "계약 담당자이름",
  "계약 담당자 이름",
  "계약담당자이름",
  "계약담당자 이름",
  "담당자이름",
  "담당자 이름",
  "이름",
  "성명"
] as const;

/** O/Y 플래그 전용 — 사람 이름 컬럼과 혼동 금지 */
const CONTRACT_CONTACT_FLAG_COLUMN_KEYS = [
  "계약담당자",
  "계약 담당자 여부",
  "계약여부"
] as const;

const FLAG_LIKE_NAMES = new Set(["o", "y", "yes", "예", "true", "1", "x", "-", "n", "no"]);

export type ParsedPartnerContactRow = {
  row_number: number;
  excluded: boolean;
  excluded_reason: string | null;
  partner_no: string | null;
  company_name: string;
  normalized_company_name: string | null;
  contract_date: string | null;
  grade: string | null;
  region_group: string | null;
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
  const partner_no = normalizeEmpty(
    pickString(row, ["No", "NO", "no", "번호", "파트너번호", "No."])
  );
  const contact_name = pickContactName(row);
  const contractFlag = normalizeBooleanFlag(
    pickRaw(row, [...CONTRACT_CONTACT_FLAG_COLUMN_KEYS])
  );

  if (!company_name) {
    return excludedRow(index, "회사명이 없습니다.");
  }

  if (!contact_name) {
    if (contractFlag) {
      return excludedRow(
        index,
        "계약담당자만 있고 담당자 이름 없음 (검토 필요)",
        company_name,
        { partner_no, contractFlag }
      );
    }
    return excludedRow(index, "담당자 이름이 없습니다.", company_name, { partner_no });
  }

  if (isFlagLikeContactName(contact_name)) {
    return excludedRow(
      index,
      `잘못된 담당자 이름 "${contact_name}" — 계약담당자(O) 플래그가 이름으로 들어간 것으로 보입니다.`,
      company_name,
      { partner_no, contractFlag }
    );
  }

  const gradeScheduled = normalizeEmpty(
    pickString(row, ["등급(예정)", "등급 (예정)", "등급예정", "등급 변경"])
  );
  const gradeBase = normalizeEmpty(pickString(row, ["등급"]));
  const gradeRaw = gradeScheduled ?? gradeBase;
  const gradeToken = gradeRaw ? normalizePartnerGrade(gradeRaw) : null;

  const role_raw = normalizeEmpty(
    pickString(row, ["담당 업무", "담당업무", "업무", "구분", "역할"])
  );
  const email = normalizeEmail(
    normalizeEmpty(
      pickString(row, ["담당자 이메일", "담당자이메일", "이메일", "메일", "email", "Email"])
    ),
    warnings
  );
  const role_type = inferRoleType(role_raw);

  return {
    row_number: index + 1,
    excluded: false,
    excluded_reason: null,
    partner_no,
    company_name,
    normalized_company_name: normalizeCompanyName(company_name),
    contract_date: normalizeEmpty(pickString(row, ["계약일자", "계약 일자"])),
    grade: gradeToken,
    region_group: normalizeEmpty(pickString(row, ["광역그룹", "광역 그룹"])),
    contact_name,
    role_raw,
    role_type,
    department: normalizeEmpty(pickString(row, ["부서", "소속부서", "담당 부서"])),
    position: normalizeEmpty(pickString(row, ["직급", "직위"])),
    phone: parsePhoneFromCell(pickRaw(row, ["연락처", "전화번호", "휴대폰", "전화", "핸드폰"])),
    email,
    is_contract_contact: contractFlag,
    source_file: PARTNER_CONTACTS_SOURCE_FILE,
    warnings
  };
}

function pickContactName(row: Record<string, unknown>): string {
  for (const key of CONTACT_NAME_COLUMN_KEYS) {
    if (!(key in row)) continue;
    const value = pickString(row, [key]);
    if (value) return value;
  }
  return "";
}

export function isFlagLikeContactName(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  return FLAG_LIKE_NAMES.has(value.trim().toLowerCase());
}

function excludedRow(
  index: number,
  reason: string,
  company_name = "",
  extra?: { partner_no?: string | null; contractFlag?: boolean }
): ParsedPartnerContactRow {
  return {
    row_number: index + 1,
    excluded: true,
    excluded_reason: reason,
    partner_no: extra?.partner_no ?? null,
    company_name,
    normalized_company_name: company_name ? normalizeCompanyName(company_name) : null,
    contract_date: null,
    grade: null,
    region_group: null,
    contact_name: "",
    role_raw: null,
    role_type: "etc",
    department: null,
    position: null,
    phone: null,
    email: null,
    is_contract_contact: extra?.contractFlag ?? false,
    source_file: PARTNER_CONTACTS_SOURCE_FILE,
    warnings: []
  };
}

function pickRaw(row: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (key in row) return row[key];
  }
  return undefined;
}

function pickString(row: Record<string, unknown>, keys: readonly string[]): string {
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

export function normalizeContactPhone(value: string | null | undefined): string {
  const result = normalizePhoneInput(value);
  return result?.normalized_phone ?? "";
}

export { normalizePartnerNo };
