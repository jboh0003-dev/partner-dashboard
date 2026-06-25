import * as XLSX from "xlsx";
import { normalizeTrainingType } from "@/lib/training/constants";

export const TRAINING_ATTENDANCE_SOURCE_FILE = "2026 오케스트로 정기교육 관리시트.xlsx";
export const TRAINING_ATTENDANCE_TARGET_SHEET = "01_교육참석_상세";

export type ParsedTrainingAttendanceRow = {
  row_number: number;
  excluded: boolean;
  excluded_reason: string | null;
  company_name: string;
  attendee_name: string;
  training_name: string;
  start_date: string | null;
  training_year: number | null;
  training_month: number | null;
  training_type: string | null;
  training_level: string | null;
  product: string | null;
  attendee_department: string | null;
  attendee_position: string | null;
  attendee_phone: string | null;
  attendee_email: string | null;
  attendance_status: string | null;
  attended: boolean;
  completion_status: string | null;
  score: number | null;
  evaluation_result: string | null;
  note: string | null;
  raw_value: string | null;
  attendee_memo: string | null;
  source_file: string;
  warnings: string[];
};

export type TrainingAttendanceParseResult = {
  sheet_name: string;
  sheet_names: string[];
  total_rows: number;
  excluded_count: number;
  warning_count: number;
  importable_count: number;
  rows: ParsedTrainingAttendanceRow[];
  headers: string[];
  column_mapping: Record<string, string | null>;
  sample_row: Record<string, string> | null;
};

type ColumnRole =
  | "company_name"
  | "attendee_name"
  | "training_name"
  | "training_year_month"
  | "training_type"
  | "training_level"
  | "product"
  | "start_date"
  | "position"
  | "department"
  | "phone"
  | "email"
  | "attendance"
  | "completion_status"
  | "score"
  | "evaluation_result"
  | "memo";

const COLUMN_ALIASES: Record<ColumnRole, string[]> = {
  company_name: ["파트너사", "회사명", "업체명", "파트너", "파트너명", "파트너사명", "고객사", "고객사명"],
  attendee_name: ["이름", "참석자명", "성명", "수강자", "참석자", "참석자이름"],
  training_name: ["교육명", "과정명", "프로그램명", "교육과정명", "교육 과정명", "교육프로그램"],
  training_year_month: [
    "교육연월",
    "교육 연월",
    "교육년월",
    "교육 년월",
    "교육일자월",
    "교육월",
    "연월",
    "교육일자(월)",
    "교육일(월)"
  ],
  training_type: ["교육구분", "교육유형", "교육종류", "구분"],
  training_level: ["교육레벨", "레벨", "교육등급", "등급"],
  product: ["제품", "제품명", "product"],
  start_date: ["교육일자", "교육일", "일자", "참석일", "교육날짜", "날짜"],
  position: ["직급", "직위", "직책"],
  department: ["직무", "담당업무", "업무", "부서", "소속부서", "담당부서", "소속"],
  phone: ["휴대폰", "연락처", "전화번호", "전화", "핸드폰"],
  email: ["이메일", "메일", "email", "e-mail", "참석자이메일", "참석자 이메일"],
  attendance: ["참석상태", "참석여부", "상태", "참석", "출석"],
  completion_status: ["수료여부", "수료", "이수여부", "이수", "completion"],
  score: ["점수", "성적", "score"],
  evaluation_result: ["평가결과", "평가", "결과", "evaluation"],
  memo: ["비고", "메모", "remark", "notes"]
};

export function parseTrainingAttendanceWorkbook(
  workbook: XLSX.WorkBook
): TrainingAttendanceParseResult {
  const sheetName = pickSheet(workbook.SheetNames);
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true
  });

  const { headerRowIndex, headers } = detectHeaderRow(matrix);
  const columnMapping = buildColumnMapping(headers);
  const defaultYear = inferYearFromWorkbook(workbook, sheetName);

  const dataRows = matrix.slice(headerRowIndex + 1).filter((row) => rowHasValues(row));
  const rows = dataRows.map((row, index) =>
    parseRow(rowToObject(headers, row), index, columnMapping, defaultYear)
  );
  const importable = rows.filter((row) => !row.excluded);

  const debugPayload = {
    sheet: sheetName,
    sheetNames: workbook.SheetNames,
    headerRowIndex,
    headers,
    columnMapping,
    totalRows: rows.length,
    importable: importable.length,
    excluded: rows.filter((r) => r.excluded).length,
    sample: importable[0] ?? rows[0] ?? null
  };
  console.log("[training-attendance-parse]", debugPayload);

  const sampleRow =
    dataRows.length > 0
      ? headers.reduce<Record<string, string>>((acc, header, idx) => {
          acc[header || `col_${idx}`] = cellToString(dataRows[0][idx]);
          return acc;
        }, {})
      : null;

  return {
    sheet_name: sheetName,
    sheet_names: workbook.SheetNames,
    total_rows: rows.length,
    excluded_count: rows.filter((row) => row.excluded).length,
    warning_count: rows.filter((row) => !row.excluded && row.warnings.length > 0).length,
    importable_count: importable.length,
    rows,
    headers,
    column_mapping: columnMapping,
    sample_row: sampleRow
  };
}

function detectHeaderRow(matrix: (string | number | null)[][]): {
  headerRowIndex: number;
  headers: string[];
} {
  const firstRow = (matrix[0] ?? []).map((cell, idx) => normalizeHeaderLabel(cell, idx));
  if (
    findColumnForRole(firstRow, "company_name") &&
    findColumnForRole(firstRow, "training_year_month") &&
    findColumnForRole(firstRow, "training_name")
  ) {
    return { headerRowIndex: 0, headers: firstRow };
  }

  let bestIndex = 0;
  let bestScore = 0;

  for (let i = 0; i < Math.min(matrix.length, 25); i += 1) {
    const row = matrix[i] ?? [];
    const headers = row.map((cell, idx) => normalizeHeaderLabel(cell, idx));
    const score = scoreHeaderRow(headers);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  const headers = (matrix[bestIndex] ?? []).map((cell, idx) => normalizeHeaderLabel(cell, idx));
  return { headerRowIndex: bestIndex, headers };
}

function normalizeHeaderLabel(cell: string | number | null | undefined, index: number): string {
  const text = cellToString(cell).trim();
  return text || `col_${index}`;
}

function scoreHeaderRow(headers: string[]): number {
  let score = 0;
  const roles = Object.keys(COLUMN_ALIASES) as ColumnRole[];
  for (const role of roles) {
    if (findColumnForRole(headers, role)) score += 1;
  }
  return score;
}

function rowHasValues(row: (string | number | null)[] | undefined): boolean {
  if (!row) return false;
  return row.some((cell) => cellToString(cell).trim().length > 0);
}

function rowToObject(
  headers: string[],
  row: (string | number | null)[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i];
    if (!header || header.startsWith("col_")) continue;
    out[header] = row[i] ?? null;
  }
  return out;
}

function pickSheet(sheetNames: string[]): string {
  if (sheetNames.length === 0) {
    throw new Error("업로드 파일에 시트가 없습니다.");
  }

  const targetNorm = normalizeName(TRAINING_ATTENDANCE_TARGET_SHEET);
  const exact = sheetNames.find((name) => normalizeName(name) === targetNorm);
  if (exact) return exact;

  const partial = sheetNames.find((name) => {
    const normalized = normalizeName(name);
    return normalized.includes("교육참석") && normalized.includes("상세");
  });
  if (partial) return partial;

  return sheetNames[0];
}

function buildColumnMapping(headers: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const roles = Object.keys(COLUMN_ALIASES) as ColumnRole[];

  for (const role of roles) {
    mapping[role] = findColumnForRole(headers, role);
  }

  return mapping;
}

function findColumnForRole(headers: string[], role: ColumnRole): string | null {
  const aliases = COLUMN_ALIASES[role];

  for (const header of headers) {
    const normalizedHeader = normalizeName(header);
    for (const alias of aliases) {
      const normalizedAlias = normalizeName(alias);
      if (
        normalizedHeader === normalizedAlias ||
        normalizedHeader.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedHeader)
      ) {
        return header;
      }
    }
  }

  return null;
}

function parseRow(
  row: Record<string, unknown>,
  index: number,
  columnMapping: Record<string, string | null>,
  defaultYear: number
): ParsedTrainingAttendanceRow {
  const warnings: string[] = [];

  const company_name = readMappedString(row, columnMapping.company_name);
  const attendee_name = readMappedString(row, columnMapping.attendee_name);
  const training_name = readMappedString(row, columnMapping.training_name);

  const yearMonthCell = readMappedValue(row, columnMapping.training_year_month);
  let { year: training_year, month: training_month } = parseTrainingYearMonthCell(
    yearMonthCell,
    defaultYear
  );

  const dateValue = columnMapping.start_date ? row[columnMapping.start_date] : undefined;
  const parsedDate = parseDate(dateValue);
  let start_date = parsedDate.iso;

  if ((!training_year || !training_month) && parsedDate.year && parsedDate.month) {
    training_year = parsedDate.year;
    training_month = parsedDate.month;
  }

  if (!start_date && training_year && training_month) {
    start_date = `${training_year}-${String(training_month).padStart(2, "0")}-01`;
  }

  const requiredCount = [
    company_name,
    attendee_name,
    training_name,
    training_year && training_month ? `${training_year}-${training_month}` : ""
  ].filter(Boolean).length;

  if (requiredCount === 0) {
    return excludedRow(
      index,
      "필수 컬럼(파트너사/이름/교육 연월/교육명) 값이 모두 비어 있습니다."
    );
  }

  if (!company_name) warnings.push("파트너사가 비어 있습니다.");
  if (!attendee_name) warnings.push("이름이 비어 있습니다.");
  if (!training_name) warnings.push("교육명이 비어 있습니다.");
  if (!training_year || !training_month) warnings.push("교육 연월을 확인할 수 없습니다.");

  const statusRaw = readMappedString(row, columnMapping.attendance);
  const attendance = normalizeAttendanceStatus(statusRaw);

  const email = normalizeEmpty(readMappedString(row, columnMapping.email));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    warnings.push(`이메일 형식 확인 필요: "${email}"`);
  }

  const training_type_raw = readMappedString(row, columnMapping.training_type);
  const training_type = training_type_raw
    ? normalizeTrainingType(training_type_raw)
    : null;
  const note = normalizeEmpty(readMappedString(row, columnMapping.memo));

  return {
    row_number: index + 1,
    excluded: false,
    excluded_reason: null,
    company_name,
    attendee_name,
    training_name,
    start_date,
    training_year,
    training_month,
    training_type,
    training_level: normalizeEmpty(readMappedString(row, columnMapping.training_level)),
    product: normalizeEmpty(readMappedString(row, columnMapping.product)),
    attendee_department: normalizeEmpty(readMappedString(row, columnMapping.department)),
    attendee_position: normalizeEmpty(readMappedString(row, columnMapping.position)),
    attendee_phone: normalizeEmpty(readMappedString(row, columnMapping.phone)),
    attendee_email: email,
    attendance_status: attendance.status,
    attended: attendance.attended,
    completion_status: normalizeEmpty(readMappedString(row, columnMapping.completion_status)),
    score: parseScore(readMappedValue(row, columnMapping.score)),
    evaluation_result: normalizeEmpty(readMappedString(row, columnMapping.evaluation_result)),
    note,
    raw_value: attendance.rawValue,
    attendee_memo: note,
    source_file: TRAINING_ATTENDANCE_SOURCE_FILE,
    warnings
  };
}

function excludedRow(index: number, reason: string): ParsedTrainingAttendanceRow {
  return {
    row_number: index + 1,
    excluded: true,
    excluded_reason: reason,
    company_name: "",
    attendee_name: "",
    training_name: "",
    start_date: null,
    training_year: null,
    training_month: null,
    training_type: null,
    training_level: null,
    product: null,
    attendee_department: null,
    attendee_position: null,
    attendee_phone: null,
    attendee_email: null,
    attendance_status: null,
    attended: false,
    completion_status: null,
    score: null,
    evaluation_result: null,
    note: null,
    raw_value: null,
    attendee_memo: null,
    source_file: TRAINING_ATTENDANCE_SOURCE_FILE,
    warnings: []
  };
}

function readMappedString(
  row: Record<string, unknown>,
  header: string | null | undefined
): string {
  if (!header || !(header in row)) return "";
  return cellToString(row[header]).trim();
}

function readMappedValue(
  row: Record<string, unknown>,
  header: string | null | undefined
): unknown {
  if (!header || !(header in row)) return null;
  return row[header];
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalizeEmpty(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeName(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/[()（）\[\]_\-/\\.]/g, "")
    .toLowerCase();
}

function parseScore(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).trim().replace(/,/g, "");
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function parseTrainingYearMonthCell(
  value: unknown,
  defaultYear: number
): { year: number | null; month: number | null } {
  if (value == null || value === "") {
    return { year: null, month: null };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { year: value.getFullYear(), month: value.getMonth() + 1 };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 40000) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        return { year: parsed.y, month: parsed.m };
      }
    }
    if (value >= 200001 && value <= 209912) {
      const digits = String(Math.trunc(value));
      const year = Number(digits.slice(0, 4));
      const month = Number(digits.slice(4, 6));
      if (month >= 1 && month <= 12) {
        return { year, month };
      }
    }
  }

  return parseTrainingYearMonth(cellToString(value), defaultYear);
}

function parseTrainingYearMonth(
  raw: string,
  defaultYear: number
): { year: number | null; month: number | null } {
  if (!raw) return { year: null, month: null };

  const text = raw.trim().replace(/\s+/g, " ");

  const isoLike = text.match(/^(20\d{2})[\.\-/](0?[1-9]|1[0-2])$/);
  if (isoLike) {
    return { year: Number(isoLike[1]), month: Number(isoLike[2]) };
  }

  const fullYearKorean = text.match(/^(20\d{2})\s*년\s*(0?[1-9]|1[0-2])\s*월?$/);
  if (fullYearKorean) {
    return { year: Number(fullYearKorean[1]), month: Number(fullYearKorean[2]) };
  }

  const shortYearKorean = text.match(/^(\d{2})\s*년\s*(0?[1-9]|1[0-2])\s*월?$/);
  if (shortYearKorean) {
    return {
      year: 2000 + Number(shortYearKorean[1]),
      month: Number(shortYearKorean[2])
    };
  }

  const compactFullYear = text.match(/^(20\d{2})(0?[1-9]|1[0-2])$/);
  if (compactFullYear) {
    return { year: Number(compactFullYear[1]), month: Number(compactFullYear[2]) };
  }

  const digits = text.replace(/[^\d]/g, "");
  if (digits.length === 6) {
    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    if (year >= 2000 && month >= 1 && month <= 12) {
      return { year, month };
    }
  }

  const monthOnly = parseMonthValue(text);
  if (monthOnly) {
    return { year: defaultYear, month: monthOnly };
  }

  const parsed = parseDate(text);
  if (parsed.year && parsed.month) {
    return { year: parsed.year, month: parsed.month };
  }

  return { year: null, month: null };
}

function parseMonthValue(raw: string): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const month = Number(digits);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return month;
}

function normalizeAttendanceStatus(raw: string | null): {
  attended: boolean;
  status: string | null;
  rawValue: string | null;
} {
  if (!raw) {
    return { attended: true, status: "참석", rawValue: null };
  }
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return { attended: true, status: "참석", rawValue: null };
  if (["o", "y", "yes", "참석", "attended", "true", "1", "출석"].includes(normalized)) {
    return { attended: true, status: "참석", rawValue: raw };
  }
  if (["x", "n", "no", "불참", "결석", "absent", "false", "0"].includes(normalized)) {
    return { attended: false, status: "불참", rawValue: raw };
  }
  return { attended: true, status: normalized, rawValue: raw };
}

function parseDate(value: unknown): {
  iso: string | null;
  year: number | null;
  month: number | null;
} {
  if (value == null || value === "") return { iso: null, year: null, month: null };

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      iso: toIsoDate(value),
      year: value.getFullYear(),
      month: value.getMonth() + 1
    };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return {
        iso: `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`,
        year: parsed.y,
        month: parsed.m
      };
    }
  }

  const text = String(value).trim();
  if (!text) return { iso: null, year: null, month: null };

  const monthOnly = text.match(/^(\d{1,2})\s*월$/);
  if (monthOnly) {
    const month = Number(monthOnly[1]);
    return { iso: null, year: null, month };
  }

  const normalized = text
    .replace(/[./]/g, "-")
    .replace(/년|월/g, "-")
    .replace(/일/g, "")
    .replace(/\s+/g, "")
    .replace(/-+$/g, "");

  const full = normalized.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (full) {
    const year = Number(full[1]);
    const month = Number(full[2]);
    const day = Number(full[3] ?? "1");
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(d.getTime())) {
      return { iso: toIsoDate(d), year, month };
    }
  }

  const dt = new Date(text);
  if (!Number.isNaN(dt.getTime())) {
    return {
      iso: toIsoDate(dt),
      year: dt.getFullYear(),
      month: dt.getMonth() + 1
    };
  }

  return { iso: null, year: null, month: null };
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inferYearFromWorkbook(workbook: XLSX.WorkBook, sheetName: string): number {
  const source = `${workbook.Props?.Title ?? ""} ${sheetName} ${TRAINING_ATTENDANCE_SOURCE_FILE}`;
  const match = source.match(/(20\d{2})/);
  if (match) return Number(match[1]);
  return new Date().getFullYear();
}
