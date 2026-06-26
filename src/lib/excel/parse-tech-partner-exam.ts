import * as XLSX from "xlsx";
import { TECH_PARTNER_EXAM_FILE_HINT } from "@/lib/tech-partner-training/constants";

export type ParsedTechPartnerExamRow = {
  row_number: number;
  rank: number | null;
  company_name: string;
  participant_name: string;
  phone: string | null;
  total_score: number | null;
  converted_score: number | null;
  solution_understanding_score: number | null;
  technical_test_score: number | null;
  advanced_basic_score: number | null;
  operation_score: number | null;
  troubleshooting_score: number | null;
  raw_json: Record<string, unknown>;
  source_file: string;
};

export type TechPartnerExamParseResult = {
  sheet_name: string;
  rows: ParsedTechPartnerExamRow[];
  headers: string[];
};

/** Worksheet 고정 레이아웃 (0-indexed): A~K */
const EXAM_HEADER_ROW = 0;
const EXAM_DATA_START_ROW = 1;
const EXAM_DATA_END_ROW = 27;
const COL = {
  RANK: 0,
  COMPANY: 1,
  NAME: 2,
  PHONE: 3,
  TOTAL: 4,
  CONVERTED: 5,
  SOLUTION: 6,
  TECHNICAL: 7,
  ADVANCED: 8,
  OPERATION: 9,
  TROUBLESHOOTING: 10
} as const;

function getCellValue(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  return sheet[addr]?.v;
}

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function parseNumber(value: unknown): number | null {
  const text = cellText(value).replace(/,/g, "");
  if (!text || text === "-") return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

export function parseTechPartnerExamWorkbook(
  workbook: XLSX.WorkBook,
  sourceFileName: string
): TechPartnerExamParseResult {
  const sheetName =
    workbook.SheetNames.find((name) => /worksheet/i.test(name)) ?? workbook.SheetNames[0];
  if (!sheetName) {
    return { sheet_name: "", rows: [], headers: [] };
  }

  const sheet = workbook.Sheets[sheetName]!;
  const headers = [
    "순위",
    "파트너사",
    "이름",
    "전화번호",
    "총점",
    "환산 점수(100)",
    "솔루션 기반기술 및 솔루션의 이해(20)",
    "기술test",
    "기반기술(심화)(5)",
    "운영관리(7.5)",
    "Troubleshooting(7.5)"
  ];

  const rows: ParsedTechPartnerExamRow[] = [];

  for (let rowIndex = EXAM_DATA_START_ROW; rowIndex <= EXAM_DATA_END_ROW; rowIndex += 1) {
    const company_name = cellText(getCellValue(sheet, rowIndex, COL.COMPANY));
    const participant_name = cellText(getCellValue(sheet, rowIndex, COL.NAME));
    if (!company_name && !participant_name) continue;

    const raw_json: Record<string, unknown> = {};
    for (let col = 0; col <= COL.TROUBLESHOOTING; col += 1) {
      raw_json[headers[col] ?? `col-${col}`] = getCellValue(sheet, rowIndex, col) ?? "";
    }

    rows.push({
      row_number: rowIndex + 1,
      rank: parseNumber(getCellValue(sheet, rowIndex, COL.RANK)),
      company_name,
      participant_name,
      phone: cellText(getCellValue(sheet, rowIndex, COL.PHONE)) || null,
      total_score: parseNumber(getCellValue(sheet, rowIndex, COL.TOTAL)),
      converted_score: parseNumber(getCellValue(sheet, rowIndex, COL.CONVERTED)),
      solution_understanding_score: parseNumber(getCellValue(sheet, rowIndex, COL.SOLUTION)),
      technical_test_score: parseNumber(getCellValue(sheet, rowIndex, COL.TECHNICAL)),
      advanced_basic_score: parseNumber(getCellValue(sheet, rowIndex, COL.ADVANCED)),
      operation_score: parseNumber(getCellValue(sheet, rowIndex, COL.OPERATION)),
      troubleshooting_score: parseNumber(getCellValue(sheet, rowIndex, COL.TROUBLESHOOTING)),
      raw_json,
      source_file: sourceFileName || TECH_PARTNER_EXAM_FILE_HINT
    });
  }

  return { sheet_name: sheetName, rows, headers };
}

export function readTechPartnerExamFile(buffer: ArrayBuffer, fileName: string) {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  return parseTechPartnerExamWorkbook(workbook, fileName);
}

export function examRowHasScore(row: ParsedTechPartnerExamRow): boolean {
  return row.total_score != null || row.converted_score != null;
}
