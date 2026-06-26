import * as XLSX from "xlsx";
import {
  TECH_PARTNER_ROSTER_DATES,
  TECH_PARTNER_ROSTER_FILE_HINT
} from "@/lib/tech-partner-training/constants";

export type DailyAttendanceValue = "present" | "partial" | "absent" | "none";

export type ParsedTechPartnerRosterRow = {
  row_number: number;
  company_name: string;
  participant_name: string;
  title: string | null;
  group_name: string | null;
  phone: string | null;
  email: string | null;
  daily_attendance: Record<string, DailyAttendanceValue>;
  attendance_days: number;
  partial_days: number;
  absent_days: number;
  attendance_rate: number;
  has_any_attendance_record: boolean;
  no_show: boolean;
  source_file: string;
};

export type TechPartnerRosterParseResult = {
  sheet_name: string;
  rows: ParsedTechPartnerRosterRow[];
  headers: string[];
};

/** 03. 교육 출석부 고정 레이아웃 (0-indexed) */
const ROSTER_HEADER_ROW = 6;
const ROSTER_DATA_START_ROW = 7;
const ROSTER_DATA_END_ROW = 41;
const COL = {
  COMPANY: 5,
  NAME: 6,
  TITLE: 7,
  GROUP: 8,
  ATTENDANCE_START: 9,
  ATTENDANCE_END: 25
} as const;

function getCellDisplayValue(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return "";
  if (cell.w != null) return String(cell.w).trim();
  if (cell.v != null) return String(cell.v).trim();
  return "";
}

export function interpretAttendanceCell(value: string): DailyAttendanceValue {
  const text = value.trim();
  if (!text) return "none";

  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? "";

  if (/^[oOㅇ]$/.test(firstLine) || /^출석인정/.test(firstLine) || /^출석인정/.test(text)) {
    return "present";
  }
  if (firstLine === "△" || text === "△") return "partial";
  if (/^[xX]$/.test(firstLine)) return "absent";
  if (/결석/.test(firstLine)) return "absent";
  if (/출석/.test(firstLine) && !/미참석|불참/.test(firstLine)) return "present";

  return "none";
}

function isSummaryRow(company: string, name: string): boolean {
  const joined = `${company} ${name}`;
  return /합계|총계|비고|소계/.test(joined);
}

export function parseTechPartnerRosterWorkbook(
  workbook: XLSX.WorkBook,
  sourceFileName: string
): TechPartnerRosterParseResult {
  const sheetName =
    workbook.SheetNames.find((name) => /03\.\s*교육\s*출석부/.test(name)) ??
    workbook.SheetNames.find((name) => /출석부/.test(name)) ??
    workbook.SheetNames[0];

  if (!sheetName) {
    return { sheet_name: "", rows: [], headers: [] };
  }

  const sheet = workbook.Sheets[sheetName]!;
  const headers: string[] = [];
  for (let col = COL.ATTENDANCE_START; col <= COL.ATTENDANCE_END; col += 1) {
    headers.push(getCellDisplayValue(sheet, ROSTER_HEADER_ROW, col));
  }

  const rows: ParsedTechPartnerRosterRow[] = [];

  for (let rowIndex = ROSTER_DATA_START_ROW; rowIndex <= ROSTER_DATA_END_ROW; rowIndex += 1) {
    const company_name = getCellDisplayValue(sheet, rowIndex, COL.COMPANY);
    const participant_name = getCellDisplayValue(sheet, rowIndex, COL.NAME);
    if (!company_name && !participant_name) continue;
    if (isSummaryRow(company_name, participant_name)) continue;

    const daily_attendance: Record<string, DailyAttendanceValue> = {};
    let attendance_days = 0;
    let partial_days = 0;
    let absent_days = 0;
    let has_any_attendance_record = false;

    let dateIdx = 0;
    for (let col = COL.ATTENDANCE_START; col <= COL.ATTENDANCE_END; col += 1) {
      const dateKey = TECH_PARTNER_ROSTER_DATES[dateIdx] ?? `col-${col}`;
      const raw = getCellDisplayValue(sheet, rowIndex, col);
      const value = interpretAttendanceCell(raw);
      daily_attendance[dateKey] = value;

      if (value !== "none") has_any_attendance_record = true;
      if (value === "present") attendance_days += 1;
      if (value === "partial") partial_days += 1;
      if (value === "absent") absent_days += 1;
      dateIdx += 1;
    }

    const attendance_rate =
      TECH_PARTNER_ROSTER_DATES.length > 0
        ? Math.round((attendance_days / TECH_PARTNER_ROSTER_DATES.length) * 1000) / 10
        : 0;

    rows.push({
      row_number: rowIndex + 1,
      company_name,
      participant_name,
      title: getCellDisplayValue(sheet, rowIndex, COL.TITLE) || null,
      group_name: getCellDisplayValue(sheet, rowIndex, COL.GROUP) || null,
      phone: null,
      email: null,
      daily_attendance,
      attendance_days,
      partial_days,
      absent_days,
      attendance_rate,
      has_any_attendance_record,
      no_show: !has_any_attendance_record,
      source_file: sourceFileName || TECH_PARTNER_ROSTER_FILE_HINT
    });
  }

  return { sheet_name: sheetName, rows, headers };
}

export function readTechPartnerRosterFile(buffer: ArrayBuffer, fileName: string) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  return parseTechPartnerRosterWorkbook(workbook, fileName);
}
