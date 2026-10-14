import * as XLSX from "xlsx";

export type ParsedTrainingRegistrationRow = {
  row_number: number;
  source_response_id: string | null;
  source_sheet: string;
  company_name: string;
  attendee_name: string;
  attendee_department: string | null;
  attendee_position: string | null;
  attendee_phone: string | null;
  attendee_email: string | null;
  training_name: string;
  product: string | null;
  start_date: string;
  source_header: string;
  raw_data: Record<string, string>;
};

export type TrainingRegistrationParseResult = {
  sheet_name: string;
  header_row: number;
  rows: ParsedTrainingRegistrationRow[];
  training_headers: Array<{
    header: string;
    training_name: string;
    product: string | null;
    start_date: string;
  }>;
  warnings: string[];
};

type HeaderMap = {
  responseId: number | null;
  company: number | null;
  name: number | null;
  department: number | null;
  position: number | null;
  phone: number | null;
  email: number | null;
};

type TrainingHeader = {
  col: number;
  header: string;
  training_name: string;
  product: string | null;
  start_date: string;
};

const COMPANY_ALIASES = [/^회사명$/i, /회사.*명/i, /소속.*회사/i, /회사\s*\/\s*기관/i];
const NAME_ALIASES = [/^성명$/i, /^성함$/i, /^이름$/i, /신청자.*명/i, /교육생.*명/i];
const DEPARTMENT_ALIASES = [/^부서$/i, /부서.*명/i, /^직무$/i, /담당.*업무/i];
const POSITION_ALIASES = [/^직급$/i, /^직책$/i, /직급.*직책/i];
const PHONE_ALIASES = [/휴대폰/i, /핸드폰/i, /전화번호/i, /연락처/i, /mobile/i, /phone/i];
const EMAIL_ALIASES = [/이메일/i, /전자.*메일/i, /e-?mail/i];
const RESPONSE_ID_ALIASES = [/^id$/i, /응답.*id/i, /response.*id/i, /번호/i];

export function parseTrainingRegistrationWorkbook(buffer: ArrayBuffer): TrainingRegistrationParseResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const candidates = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: ""
    });
    return analyzeSheet(sheetName, grid);
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (candidates.length === 0) {
    throw new Error(
      "MS Forms 교육 신청 원본 시트를 찾지 못했습니다. 회사명·성명·연락처/이메일과 날짜가 포함된 교육 질문 열을 확인해 주세요."
    );
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  const warnings: string[] = [];

  if (selected.trainingHeaders.length === 0) {
    throw new Error("교육일자가 포함된 신청 질문 열을 찾지 못했습니다.");
  }

  const parsedRows: ParsedTrainingRegistrationRow[] = [];
  const dedupe = new Set<string>();

  for (let rowIndex = selected.headerRow + 1; rowIndex < selected.grid.length; rowIndex += 1) {
    const row = selected.grid[rowIndex] ?? [];
    const companyName = cellText(row[selected.map.company]);
    const attendeeName = cellText(row[selected.map.name]);
    if (!companyName || !attendeeName) continue;

    const rawData: Record<string, string> = {};
    selected.headers.forEach((header, index) => {
      if (!header) return;
      const value = cellText(row[index]);
      if (value) rawData[header] = value;
    });

    for (const training of selected.trainingHeaders) {
      const response = cellText(row[training.col]);
      if (!isRegisteredResponse(response)) continue;

      const email = nullableCell(row, selected.map.email);
      const phone = nullableCell(row, selected.map.phone);
      const sourceResponseId = nullableCell(row, selected.map.responseId);
      const key = [
        training.start_date,
        normalizeKey(training.training_name),
        normalizeKey(companyName),
        normalizeKey(attendeeName),
        normalizeKey(email ?? phone ?? sourceResponseId ?? String(rowIndex + 1))
      ].join("|");
      if (dedupe.has(key)) continue;
      dedupe.add(key);

      parsedRows.push({
        row_number: rowIndex + 1,
        source_response_id: sourceResponseId,
        source_sheet: selected.sheetName,
        company_name: companyName,
        attendee_name: attendeeName,
        attendee_department: nullableCell(row, selected.map.department),
        attendee_position: nullableCell(row, selected.map.position),
        attendee_phone: phone,
        attendee_email: email,
        training_name: training.training_name,
        product: training.product,
        start_date: training.start_date,
        source_header: training.header,
        raw_data: rawData
      });
    }
  }

  if (parsedRows.length === 0) {
    warnings.push("교육 신청값(참석/신청/참여)이 표시된 행을 찾지 못했습니다.");
  }

  return {
    sheet_name: selected.sheetName,
    header_row: selected.headerRow + 1,
    rows: parsedRows,
    training_headers: selected.trainingHeaders.map(({ header, training_name, product, start_date }) => ({
      header,
      training_name,
      product,
      start_date
    })),
    warnings
  };
}

function analyzeSheet(sheetName: string, grid: unknown[][]) {
  let best:
    | {
        sheetName: string;
        grid: unknown[][];
        headerRow: number;
        headers: string[];
        map: HeaderMap & { company: number; name: number };
        trainingHeaders: TrainingHeader[];
        score: number;
      }
    | null = null;

  for (let rowIndex = 0; rowIndex < Math.min(12, grid.length); rowIndex += 1) {
    const headers = (grid[rowIndex] ?? []).map(cellText);
    const company = findHeader(headers, COMPANY_ALIASES);
    const name = findHeader(headers, NAME_ALIASES);
    if (company === null || name === null) continue;

    const trainingHeaders = headers
      .map((header, col) => parseTrainingHeader(header, col))
      .filter((item): item is TrainingHeader => Boolean(item));

    const map: HeaderMap & { company: number; name: number } = {
      responseId: findHeader(headers, RESPONSE_ID_ALIASES),
      company,
      name,
      department: findHeader(headers, DEPARTMENT_ALIASES),
      position: findHeader(headers, POSITION_ALIASES),
      phone: findHeader(headers, PHONE_ALIASES),
      email: findHeader(headers, EMAIL_ALIASES)
    };

    const score =
      10 +
      trainingHeaders.length * 8 +
      (map.phone !== null ? 2 : 0) +
      (map.email !== null ? 2 : 0) +
      (/교육.*신청|forms|응답|response/i.test(sheetName) ? 5 : 0);

    if (!best || score > best.score) {
      best = { sheetName, grid, headerRow: rowIndex, headers, map, trainingHeaders, score };
    }
  }

  return best;
}

function parseTrainingHeader(header: string, col: number): TrainingHeader | null {
  const trimmed = header.trim();
  if (!trimmed) return null;

  const dateMatch = trimmed.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!dateMatch) return null;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  if (!isValidDate(year, month, day)) return null;

  const startDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const product = inferProduct(trimmed);
  const cleaned = trimmed
    .replace(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})(일)?/g, "")
    .replace(/[\[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,_-]+|[\s:;,_-]+$/g, "")
    .trim();

  const trainingName = product || cleaned || `${year}년 ${month}월 정기교육`;
  return { col, header: trimmed, training_name: trainingName, product, start_date: startDate };
}

function inferProduct(value: string): string | null {
  const upper = value.toUpperCase();
  for (const product of ["CONTRABASS", "VIOLA", "TROMBONE", "CMP"]) {
    if (upper.includes(product)) return product;
  }
  return null;
}

function findHeader(headers: string[], aliases: RegExp[]): number | null {
  for (const alias of aliases) {
    const index = headers.findIndex((header) => alias.test(header.trim()));
    if (index >= 0) return index;
  }
  return null;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function nullableCell(row: unknown[], index: number | null): string | null {
  if (index === null) return null;
  const value = cellText(row[index]);
  return value || null;
}

function isRegisteredResponse(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized) return false;
  if (["o", "○", "y", "yes", "true", "1"].includes(normalized)) return true;
  return /(참석|신청|참여|희망)/.test(normalized) && !/(불참|미참석|미신청|취소|참여안)/.test(normalized);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
