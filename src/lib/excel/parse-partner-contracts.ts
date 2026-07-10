import * as XLSX from "xlsx";

export const TARGET_SHEET_NAME = "1.파트너계약현황";

export type MonthlyAttendanceCell = {
  training_year: number;
  training_month: number;
  training_label: string;
  attended: boolean;
  raw_value: string;
};

export type MonthlyColumnInfo = {
  training_year: number;
  training_month: number;
  training_label: string;
};

export type ParsedPartnerRow = {
  row_index: number;
  excluded: boolean;
  excluded_reason: string | null;
  warnings: string[];

  no: number | null;
  company_name: string;
  grade_raw: string | null;
  grade: string;
  contract_start_date: string | null;
  contract_start_raw: string | null;
  primary_email: string | null;
  email_memo: string | null;
  has_training: boolean;
  theory_only: boolean;
  has_sales_opportunity: boolean;
  data_quality_warning: string | null;

  monthly: MonthlyAttendanceCell[];
};

export type ParseResult = {
  sheet_name: string;
  total_rows: number;
  excluded_count: number;
  warning_count: number;
  rows: ParsedPartnerRow[];
  monthly_columns: MonthlyColumnInfo[];
};

const MONTH_HEADER_REGEX = /^\s*(\d{2})\s*년\s*(\d{1,2})\s*월\s*$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_EXTRACT_REGEX = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;

export function parsePartnerContractsWorkbook(workbook: XLSX.WorkBook): ParseResult {
  const sheetName =
    workbook.SheetNames.find((n) => n.trim() === TARGET_SHEET_NAME) ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true
  });

  const monthly_columns = detectMonthlyColumns(json);

  const parsed: ParsedPartnerRow[] = json.map((row, idx) =>
    parseRow(row, idx, monthly_columns)
  );

  return {
    sheet_name: sheetName,
    total_rows: json.length,
    excluded_count: parsed.filter((r) => r.excluded).length,
    warning_count: parsed.filter((r) => !r.excluded && r.warnings.length > 0).length,
    rows: parsed,
    monthly_columns
  };
}

function detectMonthlyColumns(rows: Array<Record<string, unknown>>): MonthlyColumnInfo[] {
  if (rows.length === 0) return [];
  const seen = new Map<string, MonthlyColumnInfo>();

  // 첫 행만 보면 빈 셀/병합 헤더 때문에 월 컬럼을 놓칠 수 있어 전체 행의 키를 union 한다.
  const allKeys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }

  for (const key of allKeys) {
    const m = key.match(MONTH_HEADER_REGEX);
    if (!m) continue;
    const yy = Number(m[1]);
    const month = Number(m[2]);
    if (!Number.isFinite(yy) || !Number.isFinite(month)) continue;
    if (month < 1 || month > 12) continue;
    const year = 2000 + yy;
    const id = `${year}-${month}`;
    if (!seen.has(id)) {
      seen.set(id, { training_year: year, training_month: month, training_label: key });
    }
  }
  return Array.from(seen.values()).sort((a, b) => {
    if (a.training_year !== b.training_year) return a.training_year - b.training_year;
    return a.training_month - b.training_month;
  });
}

function parseRow(
  row: Record<string, unknown>,
  index: number,
  monthly_columns: MonthlyColumnInfo[]
): ParsedPartnerRow {
  const warnings: string[] = [];

  const company_name = pickString(row, ["회사명", "파트너사명", "파트너사"]);
  if (!company_name) {
    return excludedRow(index, "회사명 없음");
  }

  const noRaw = pickRaw(row, ["No", "no", "NO", "번호"]);
  const no = parseIntSafe(noRaw);

  const grade_raw_value = pickString(row, ["등급(변경)", "등급 (변경)", "등급"]);
  const grade = normalizeGrade(grade_raw_value);

  const contract_raw = pickRaw(row, ["계약일자", "계약일", "계약 일자"]);
  const { iso: contract_start_date, raw: contract_start_raw, warning: dateWarning } =
    parseContractDate(contract_raw);
  if (dateWarning) warnings.push(dateWarning);

  const emailRaw = pickString(row, [
    "담당자 이메일",
    "담당자이메일",
    "담당자 메일",
    "이메일"
  ]);
  const { email, memo: email_memo, warning: emailWarning } = splitEmailAndMemo(emailRaw);
  if (emailWarning) warnings.push(emailWarning);

  const trainingAttendCell = pickRaw(row, ["교육참석", "교육 참석"]);
  const has_training = isAttendedValue(trainingAttendCell);

  const theoryRaw = pickRaw(row, ["이론만수강", "이론만 수강"]);
  const theory_only = isAttendedValue(theoryRaw);

  const opportunityRaw = pickRaw(row, [
    "25~26년 영업기회",
    "25-26년 영업기회",
    "영업기회"
  ]);
  const has_sales_opportunity = isAttendedValue(opportunityRaw);

  const monthly: MonthlyAttendanceCell[] = monthly_columns.map((col) => {
    const cell = row[col.training_label];
    return {
      training_year: col.training_year,
      training_month: col.training_month,
      training_label: col.training_label,
      attended: isAttendedValue(cell),
      raw_value: rawCellToString(cell)
    };
  });

  const data_quality_warning = warnings.length > 0 ? warnings.join("; ") : null;

  return {
    row_index: index,
    excluded: false,
    excluded_reason: null,
    warnings,

    no,
    company_name,
    grade_raw: grade_raw_value,
    grade,
    contract_start_date,
    contract_start_raw,
    primary_email: email,
    email_memo,
    has_training,
    theory_only,
    has_sales_opportunity,
    data_quality_warning,
    monthly
  };
}

function excludedRow(index: number, reason: string): ParsedPartnerRow {
  return {
    row_index: index,
    excluded: true,
    excluded_reason: reason,
    warnings: [],
    no: null,
    company_name: "",
    grade_raw: null,
    grade: "none",
    contract_start_date: null,
    contract_start_raw: null,
    primary_email: null,
    email_memo: null,
    has_training: false,
    theory_only: false,
    has_sales_opportunity: false,
    data_quality_warning: null,
    monthly: []
  };
}

function pickRaw(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row) return row[key];
  }
  return undefined;
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  const v = pickRaw(row, keys);
  return rawCellToString(v).trim();
}

function rawCellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return "";
    return v.toISOString();
  }
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return String(v);
}

function parseIntSafe(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function normalizeGrade(input: string | null | undefined): string {
  if (!input) return "none";
  const label = input.trim();
  if (!label) return "none";

  const primary = label.match(/^([^()（）[\]]+)/)?.[1]?.trim() ?? label;
  const s = primary.toLowerCase();
  if (s.includes("플래티넘") || s.includes("플라티넘") || s.includes("platinum")) {
    return "platinum";
  }
  if (s.includes("골드") || s.includes("gold")) return "gold";
  if (s.includes("실버") || s.includes("silver")) return "silver";
  if (
    s === "서비스" ||
    s === "service" ||
    s.includes("서비스파트너") ||
    s.includes("서비스 파트너") ||
    s.includes("service partner") ||
    s.includes("servicepartner")
  ) {
    return "service_partner";
  }
  if (s.includes("strategic") || s.includes("전략")) return "strategic";
  return "none";
}

export function parseContractDate(v: unknown): {
  iso: string | null;
  raw: string | null;
  warning: string | null;
} {
  if (v === null || v === undefined || v === "") {
    return { iso: null, raw: null, warning: null };
  }
  const raw = rawCellToString(v);

  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return { iso: toIsoDate(v), raw, warning: null };
  }

  if (typeof v === "number" && Number.isFinite(v)) {
    const d = excelSerialToDate(v);
    if (d) return { iso: toIsoDate(d), raw, warning: null };
  }

  if (typeof v === "string") {
    const cleaned = v.trim();
    if (!cleaned) return { iso: null, raw: null, warning: null };
    const normalized = cleaned
      .replace(/[./]/g, "-")
      .replace(/년|월/g, "-")
      .replace(/일/g, "")
      .replace(/\s+/g, "")
      .replace(/-+$/g, "");
    const m = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(d.getTime())) {
        return { iso: toIsoDate(d), raw, warning: null };
      }
    }
    const m2 = normalized.match(/^(\d{2})-(\d{1,2})-(\d{1,2})$/);
    if (m2) {
      const year = 2000 + Number(m2[1]);
      const month = Number(m2[2]);
      const day = Number(m2[3]);
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(d.getTime())) {
        return { iso: toIsoDate(d), raw, warning: null };
      }
    }
    return { iso: null, raw, warning: `계약일자 형식 인식 실패: "${cleaned}"` };
  }

  return { iso: null, raw, warning: `계약일자 형식 인식 실패: "${raw}"` };
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(utcMs);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function splitEmailAndMemo(input: string | null | undefined): {
  email: string | null;
  memo: string | null;
  warning: string | null;
} {
  if (!input) return { email: null, memo: null, warning: null };
  const trimmed = input.trim();
  if (!trimmed) return { email: null, memo: null, warning: null };

  const memoMatch = trimmed.match(/[（(]([^）)]*)[）)]/);
  const memo = memoMatch ? memoMatch[1].trim() || null : null;
  const withoutMemo = memoMatch ? trimmed.replace(memoMatch[0], "").trim() : trimmed;

  const emailMatch = withoutMemo.match(EMAIL_EXTRACT_REGEX);
  if (emailMatch) {
    const email = emailMatch[0];
    const valid = EMAIL_REGEX.test(email);
    return {
      email,
      memo,
      warning: valid ? null : `이메일 형식 확인 필요: "${email}"`
    };
  }

  if (withoutMemo) {
    return {
      email: withoutMemo,
      memo,
      warning: `이메일 형식 확인 필요: "${withoutMemo}"`
    };
  }

  return { email: null, memo, warning: null };
}

export function isAttendedValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") {
    return false;
  }
  const s = String(v).trim().toLowerCase();
  if (!s) return false;
  if (s === "o" || s === "ｏ" || s === "○" || s === "y" || s === "yes" || s === "true") {
    return true;
  }
  if (s === "참석" || s === "해당" || s === "있음") return true;
  return false;
}
