import * as XLSX from "xlsx";
import {
  INVENTORY_SHEET_PATTERN,
  NEW_REG_SUMMARY_PATTERN,
  REVENUE_PARTNER_SHEET_PATTERN,
  REVENUE_PIVOT_SHEET_PATTERN,
  WIN_FORECAST_SUMMARY_PATTERN
} from "@/lib/performance/constants";
import { resolvePipelineSnapshotDate } from "@/lib/performance/snapshot-date";
import {
  isFlagO,
  isFy26,
  isRegisteredYear2026,
  parseNumericCell,
  parseSnapshotLabelToDate,
  parseWinProbabilityValue
} from "@/lib/performance/format";

export type ParsedInventoryRow = {
  row_number: number;
  customer_name: string | null;
  project_code: string;
  project_registered_year: string | null;
  project_name: string | null;
  sales_owner: string | null;
  division: string | null;
  company: string | null;
  org_path: string | null;
  expected_win_year: string | null;
  expected_win_quarter: string | null;
  expected_win_month: string | null;
  importance: string | null;
  rfp_reflection: string | null;
  win_probability_label: string | null;
  win_probability_value: number | null;
  win_status: string | null;
  execution_status: string | null;
  participation_type: string | null;
  contract_owner: string | null;
  expected_contract_partner: string | null;
  is_partner_deal: boolean;
  partner_grade: string | null;
  partner_name: string | null;
  is_product_revenue: boolean;
  contract_type: string | null;
  product_amount_million: number | null;
  service_amount_million: number | null;
  maintenance_amount_million: number | null;
  total_amount_million: number | null;
  product_contrabass: number | null;
  product_contrabass_hci: number | null;
  product_contrabass_legato: number | null;
  product_viola: number | null;
  product_cmp: number | null;
  product_trombone: number | null;
  product_trumpet: number | null;
  product_symphony_ai: number | null;
  product_tuba: number | null;
  product_gaidsp: number | null;
  raw_json: Record<string, unknown>;
};

export type ParsedRevenueRow = {
  row_number: number;
  partner_name: string;
  partner_grade: string | null;
  sales_owner: string | null;
  product_revenue_million: number;
  project_count: number | null;
  customer_name: string | null;
  project_code: string | null;
  project_name: string | null;
  raw_json: Record<string, unknown>;
};

export type SummaryValidationValues = {
  win_forecast_total_amount_million: number | null;
  win_forecast_total_count: number | null;
  win_forecast_partner_amount_million: number | null;
  win_forecast_partner_count: number | null;
  new_reg_total_amount_million: number | null;
  new_reg_total_count: number | null;
  new_reg_partner_amount_million: number | null;
  new_reg_partner_count: number | null;
};

export type PartnerPerformanceParseResult = {
  inventory_sheet_name: string | null;
  snapshot_label: string | null;
  snapshot_date: string | null;
  inventory_rows: ParsedInventoryRow[];
  revenue_rows: ParsedRevenueRow[];
  summary_validation: SummaryValidationValues;
  parse_errors: string[];
  required_columns_found: boolean;
};

const HEADER_ROW = 1;
const DATA_START_ROW = 2;

const HEADER_ALIASES: Record<string, string[]> = {
  customer_name: ["고객사명"],
  project_code: ["프로젝트코드"],
  project_registered_year: ["프로젝트 등록(년)", "프로젝트등록(년)", "프로젝트 등록년"],
  project_name: ["프로젝트명"],
  sales_owner: ["영업담당자"],
  division: ["본부"],
  company: ["회사"],
  org_path: ["소속"],
  expected_win_year: ["예상수주연도"],
  expected_win_quarter: ["예상수주분기"],
  expected_win_month: ["예상수주월"],
  importance: ["중요도"],
  rfp_reflection: ["RFP반영율", "RFP 반영율"],
  win_probability_label: ["수주확도"],
  win_status: ["수주상태"],
  execution_status: ["수행상태"],
  participation_type: ["참여형태"],
  contract_owner: ["계약 주체", "계약주체"],
  expected_contract_partner: ["계약 (예상) 업체", "계약(예상) 업체"],
  is_partner_deal: ["파트너딜 여부", "파트너딜여부"],
  partner_grade: ["파트너 등급", "파트너등급"],
  partner_name: ["파트너"],
  is_product_revenue: ["제품매출"],
  contract_type: ["계약구분"],
  product_contrabass: ["Contrabass(IaaS)", "Contrabass"],
  product_contrabass_hci: ["Contrabass HCI(IaaS)", "Contrabass HCI"],
  product_contrabass_legato: ["Contrabass Legato"],
  product_viola: ["VIOLA(PaaS)", "VIOLA"],
  product_cmp: ["OKESTRO CMP", "CMP"],
  product_trombone: ["TROMBONE(DevOps)", "TROMBONE"],
  product_trumpet: ["TRUMPET(MLOps)", "TRUMPET"],
  product_symphony_ai: ["SYMPHONY A.I.(AIOps)", "SYMPHONY"],
  product_tuba: ["TUBA(DataOps)", "TUBA"],
  product_gaidsp: ["G-AIDSP(AGI 증강검색)", "G-AIDSP"],
  product_amount_million: ["제품 합계", "제품합계"],
  service_amount_million: ["상품"],
  maintenance_amount_million: ["유지보수"],
  total_amount_million: ["총 합계", "총합계"]
};

const REQUIRED_KEYS = ["project_code", "is_partner_deal", "is_product_revenue", "product_amount_million"] as const;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function getCell(sheet: XLSX.WorkSheet, row: number, col: number): unknown {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = sheet[addr];
  if (!cell) return null;
  if (cell.v != null) return cell.v;
  if (cell.w != null) return cell.w;
  return null;
}

function getCellText(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const value = getCell(sheet, row, col);
  if (value == null) return "";
  return String(value).trim();
}

function buildColumnMap(sheet: XLSX.WorkSheet): Record<string, number> {
  const map: Record<string, number> = {};
  const usedHeaders = new Set<string>();

  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const header = normalizeHeader(getCell(sheet, HEADER_ROW, col));
    if (!header || usedHeaders.has(header)) continue;

    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[key] != null) continue;
      const matched = aliases.some((alias) => normalizeHeader(alias) === header);
      if (matched) {
        map[key] = col;
        usedHeaders.add(header);
        break;
      }
    }
  }

  return map;
}

function extractSnapshotLabel(sheetName: string): string | null {
  const match = sheetName.match(/\((\d{6})\)/);
  return match?.[1] ?? null;
}

function isSummaryDataRow(projectCode: string, customer: string, projectName: string): boolean {
  const joined = `${projectCode} ${customer} ${projectName}`;
  return /합계|총계|소계|비고/.test(joined);
}

export function parseInventorySheet(
  sheet: XLSX.WorkSheet,
  sheetName: string
): { rows: ParsedInventoryRow[]; columnMap: Record<string, number> } {
  const columnMap = buildColumnMap(sheet);
  const rows: ParsedInventoryRow[] = [];
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");

  for (let row = DATA_START_ROW; row <= range.e.r; row += 1) {
    const projectCode = columnMap.project_code != null ? getCellText(sheet, row, columnMap.project_code) : "";
    const customer =
      columnMap.customer_name != null ? getCellText(sheet, row, columnMap.customer_name) : "";
    const projectName =
      columnMap.project_name != null ? getCellText(sheet, row, columnMap.project_name) : "";

    if (!projectCode && !customer && !projectName) continue;
    if (isSummaryDataRow(projectCode, customer, projectName)) continue;

    const read = (key: keyof typeof HEADER_ALIASES): unknown => {
      const col = columnMap[key];
      return col != null ? getCell(sheet, row, col) : null;
    };

    const winLabel = read("win_probability_label");
    const winLabelText = winLabel != null ? String(winLabel).trim() : null;

    const rowData: ParsedInventoryRow = {
      row_number: row + 1,
      customer_name: customer || null,
      project_code: projectCode,
      project_registered_year:
        read("project_registered_year") != null
          ? String(read("project_registered_year")).trim()
          : null,
      project_name: projectName || null,
      sales_owner: read("sales_owner") != null ? String(read("sales_owner")).trim() : null,
      division: read("division") != null ? String(read("division")).trim() : null,
      company: read("company") != null ? String(read("company")).trim() : null,
      org_path: read("org_path") != null ? String(read("org_path")).trim() : null,
      expected_win_year:
        read("expected_win_year") != null ? String(read("expected_win_year")).trim() : null,
      expected_win_quarter:
        read("expected_win_quarter") != null ? String(read("expected_win_quarter")).trim() : null,
      expected_win_month:
        read("expected_win_month") != null ? String(read("expected_win_month")).trim() : null,
      importance: read("importance") != null ? String(read("importance")).trim() : null,
      rfp_reflection: read("rfp_reflection") != null ? String(read("rfp_reflection")).trim() : null,
      win_probability_label: winLabelText,
      win_probability_value: parseWinProbabilityValue(winLabelText),
      win_status: read("win_status") != null ? String(read("win_status")).trim() : null,
      execution_status:
        read("execution_status") != null ? String(read("execution_status")).trim() : null,
      participation_type:
        read("participation_type") != null ? String(read("participation_type")).trim() : null,
      contract_owner: read("contract_owner") != null ? String(read("contract_owner")).trim() : null,
      expected_contract_partner:
        read("expected_contract_partner") != null
          ? String(read("expected_contract_partner")).trim()
          : null,
      is_partner_deal: isFlagO(read("is_partner_deal")),
      partner_grade: read("partner_grade") != null ? String(read("partner_grade")).trim() : null,
      partner_name: read("partner_name") != null ? String(read("partner_name")).trim() : null,
      is_product_revenue: isFlagO(read("is_product_revenue")),
      contract_type: read("contract_type") != null ? String(read("contract_type")).trim() : null,
      product_amount_million: parseNumericCell(read("product_amount_million")),
      service_amount_million: parseNumericCell(read("service_amount_million")),
      maintenance_amount_million: parseNumericCell(read("maintenance_amount_million")),
      total_amount_million: parseNumericCell(read("total_amount_million")),
      product_contrabass: parseNumericCell(read("product_contrabass")),
      product_contrabass_hci: parseNumericCell(read("product_contrabass_hci")),
      product_contrabass_legato: parseNumericCell(read("product_contrabass_legato")),
      product_viola: parseNumericCell(read("product_viola")),
      product_cmp: parseNumericCell(read("product_cmp")),
      product_trombone: parseNumericCell(read("product_trombone")),
      product_trumpet: parseNumericCell(read("product_trumpet")),
      product_symphony_ai: parseNumericCell(read("product_symphony_ai")),
      product_tuba: parseNumericCell(read("product_tuba")),
      product_gaidsp: parseNumericCell(read("product_gaidsp")),
      raw_json: {
        sheet_name: sheetName,
        row_number: row + 1
      }
    };

    rows.push(rowData);
  }

  return { rows, columnMap };
}

function parseSummarySheet(sheet: XLSX.WorkSheet): Partial<SummaryValidationValues> {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  const values: Partial<SummaryValidationValues> = {};

  for (let row = range.s.r; row <= Math.min(range.e.r, range.s.r + 40); row += 1) {
    for (let col = range.s.c; col <= Math.min(range.e.c, range.s.c + 12); col += 1) {
      const label = getCellText(sheet, row, col).replace(/\s+/g, "");
      const amount = parseNumericCell(getCell(sheet, row, col + 1));
      const count = parseNumericCell(getCell(sheet, row, col + 2));

      if (/전체.*제품매출|전체제품매출/.test(label) && amount != null) {
        values.win_forecast_total_amount_million = amount;
        if (count != null) values.win_forecast_total_count = Math.round(count);
      }
      if (/파트너.*제품매출|파트너제품매출/.test(label) && amount != null) {
        values.win_forecast_partner_amount_million = amount;
        if (count != null) values.win_forecast_partner_count = Math.round(count);
      }
      if (/신규등록.*전체|전체.*신규/.test(label) && amount != null) {
        values.new_reg_total_amount_million = amount;
        if (count != null) values.new_reg_total_count = Math.round(count);
      }
      if (/신규등록.*파트너|파트너.*신규/.test(label) && amount != null) {
        values.new_reg_partner_amount_million = amount;
        if (count != null) values.new_reg_partner_count = Math.round(count);
      }
    }
  }

  return values;
}

type RevenueSectionColMap = {
  partner_name?: number;
  partner_grade?: number;
  sales_owner?: number;
  revenue_2025?: number;
  project_count?: number;
};

function normalizePartnerKey(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

function isRevenueSummaryPartnerRow(partnerName: string): boolean {
  const normalized = partnerName.replace(/\s+/g, "");
  if (!normalized) return true;
  if (/^(합계|총계|소계|계)$/.test(normalized)) return true;
  if (/소계$|합계$|총계$/.test(normalized)) return true;
  if (
    /^(플래티넘|실버|골드|gold|silver|platinum|서비스|service)/i.test(normalized) &&
    /소계|합계/.test(normalized)
  ) {
    return true;
  }
  return false;
}

function isProjectSectionLabel(text: string): boolean {
  const normalized = text.replace(/\s+/g, "");
  return /프로젝트/.test(normalized) && /(수|건)/.test(normalized);
}

function classifyRevenueHeader(header: string, section: "revenue" | "project"): keyof RevenueSectionColMap | null {
  const h = normalizeHeader(header);
  if (!h) return null;

  if (h.includes("파트너명") || (h.includes("파트너") && !h.includes("등급") && !h.includes("딜"))) {
    return "partner_name";
  }
  if (h.includes("파트너등급") || h === "등급") return "partner_grade";
  if (h.includes("영업담당")) return "sales_owner";

  if (section === "revenue") {
    if (/2025.*소계/.test(h) || h === "2025년소계" || h === "2025소계") return "revenue_2025";
    if (/2025년$/.test(h) || h === "2025") return "revenue_2025";
    if (h.includes("매출") || h.includes("제품매출") || h.includes("제품합계")) return "revenue_2025";
  }

  if (section === "project") {
    if (h.includes("프로젝트") && (h.includes("수") || h.includes("건"))) return "project_count";
    if (h.includes("건수")) return "project_count";
    if (/2025.*소계/.test(h) || h === "2025년소계" || /2025년$/.test(h) || h === "2025") {
      return "project_count";
    }
  }

  return null;
}

function findSectionHeaderRow(
  sheet: XLSX.WorkSheet,
  range: XLSX.Range,
  section: "revenue" | "project",
  startRow: number
): { headerRow: number; colMap: RevenueSectionColMap } | null {
  const searchEnd = Math.min(range.e.r, startRow + 45);

  for (let row = startRow; row <= searchEnd; row += 1) {
    const colMap: RevenueSectionColMap = {};
    let hasProjectSectionMarker = false;

    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const headerText = getCellText(sheet, row, col);
      if (isProjectSectionLabel(headerText)) {
        hasProjectSectionMarker = true;
      }
      const key = classifyRevenueHeader(headerText, section);
      if (key) colMap[key] = col;
    }

    if (section === "project" && hasProjectSectionMarker && colMap.partner_name != null) {
      return { headerRow: row, colMap };
    }

    if (section === "revenue" && colMap.partner_name != null && colMap.revenue_2025 != null) {
      return { headerRow: row, colMap };
    }
  }

  return null;
}

function parsePartnerSectionRows(
  sheet: XLSX.WorkSheet,
  sheetName: string,
  range: XLSX.Range,
  headerRow: number,
  colMap: RevenueSectionColMap,
  mode: "revenue" | "project",
  stopBeforeRow?: number
): ParsedRevenueRow[] {
  const rows: ParsedRevenueRow[] = [];
  const endRow = stopBeforeRow != null ? Math.min(range.e.r, stopBeforeRow - 1) : range.e.r;
  let blankStreak = 0;

  for (let row = headerRow + 1; row <= endRow; row += 1) {
    const partnerName =
      colMap.partner_name != null ? getCellText(sheet, row, colMap.partner_name) : "";
    if (!partnerName) {
      blankStreak += 1;
      if (blankStreak >= 3) break;
      continue;
    }
    blankStreak = 0;

    if (isProjectSectionLabel(partnerName)) break;
    if (isRevenueSummaryPartnerRow(partnerName)) continue;

    if (mode === "revenue") {
      const amount =
        colMap.revenue_2025 != null
          ? parseNumericCell(getCell(sheet, row, colMap.revenue_2025))
          : null;
      if (amount == null || amount <= 0) continue;

      rows.push({
        row_number: row + 1,
        partner_name: partnerName,
        partner_grade:
          colMap.partner_grade != null ? getCellText(sheet, row, colMap.partner_grade) || null : null,
        sales_owner:
          colMap.sales_owner != null ? getCellText(sheet, row, colMap.sales_owner) || null : null,
        product_revenue_million: amount,
        project_count: null,
        customer_name: null,
        project_code: null,
        project_name: null,
        raw_json: { sheet_name: sheetName, row_number: row + 1, section: "revenue" }
      });
      continue;
    }

    const projectCount =
      colMap.project_count != null
        ? parseNumericCell(getCell(sheet, row, colMap.project_count))
        : null;
    if (projectCount == null || projectCount <= 0) continue;

    rows.push({
      row_number: row + 1,
      partner_name: partnerName,
      partner_grade:
        colMap.partner_grade != null ? getCellText(sheet, row, colMap.partner_grade) || null : null,
      sales_owner: null,
      product_revenue_million: 0,
      project_count: Math.round(projectCount),
      customer_name: null,
      project_code: null,
      project_name: null,
      raw_json: { sheet_name: sheetName, row_number: row + 1, section: "project_count" }
    });
  }

  return rows;
}

/** 25년 파트너 실적 시트 — 매출(2025년 소계) + 프로젝트 수 섹션 파싱 */
export function parseRevenueSheet(sheet: XLSX.WorkSheet, sheetName: string): ParsedRevenueRow[] {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  const revenueHeader = findSectionHeaderRow(sheet, range, "revenue", range.s.r);
  if (!revenueHeader) return [];

  const projectHeader = findSectionHeaderRow(
    sheet,
    range,
    "project",
    revenueHeader.headerRow + 5
  );

  const revenueRows = parsePartnerSectionRows(
    sheet,
    sheetName,
    range,
    revenueHeader.headerRow,
    revenueHeader.colMap,
    "revenue",
    projectHeader?.headerRow
  );

  const projectRows = projectHeader
    ? parsePartnerSectionRows(
        sheet,
        sheetName,
        range,
        projectHeader.headerRow,
        projectHeader.colMap,
        "project"
      )
    : [];

  const projectCountByPartner = new Map<string, number>();
  for (const row of projectRows) {
    const key = normalizePartnerKey(row.partner_name);
    projectCountByPartner.set(key, row.project_count ?? 0);
  }

  return revenueRows.map((row) => ({
    ...row,
    project_count: projectCountByPartner.get(normalizePartnerKey(row.partner_name)) ?? null
  }));
}

export function parseRevenueRowsFromWorkbook(workbook: XLSX.WorkBook): ParsedRevenueRow[] {
  const revenueSheetName =
    workbook.SheetNames.find((name) => REVENUE_PARTNER_SHEET_PATTERN.test(name)) ??
    workbook.SheetNames.find((name) => REVENUE_PIVOT_SHEET_PATTERN.test(name));
  if (!revenueSheetName) return [];
  return parseRevenueSheet(workbook.Sheets[revenueSheetName]!, revenueSheetName);
}

export function parsePartnerPerformanceWorkbook(
  workbook: XLSX.WorkBook,
  sourceFileName: string
): PartnerPerformanceParseResult {
  const parse_errors: string[] = [];
  const summary_validation: SummaryValidationValues = {
    win_forecast_total_amount_million: null,
    win_forecast_total_count: null,
    win_forecast_partner_amount_million: null,
    win_forecast_partner_count: null,
    new_reg_total_amount_million: null,
    new_reg_total_count: null,
    new_reg_partner_amount_million: null,
    new_reg_partner_count: null
  };

  const inventorySheetName = workbook.SheetNames.find((name) => INVENTORY_SHEET_PATTERN.test(name));
  let inventory_rows: ParsedInventoryRow[] = [];
  let columnMap: Record<string, number> = {};
  let snapshot_label: string | null = null;
  let snapshot_date: string | null = null;

  if (!inventorySheetName) {
    parse_errors.push("인벤토리 rawdata 시트를 찾지 못했습니다.");
  } else {
    const sheet = workbook.Sheets[inventorySheetName]!;
    const parsed = parseInventorySheet(sheet, inventorySheetName);
    inventory_rows = parsed.rows;
    columnMap = parsed.columnMap;
    snapshot_label = extractSnapshotLabel(inventorySheetName);
    snapshot_date = snapshot_label ? parseSnapshotLabelToDate(snapshot_label) : null;
  }

  const winSummaryName = workbook.SheetNames.find((name) => WIN_FORECAST_SUMMARY_PATTERN.test(name));
  if (winSummaryName) {
    Object.assign(summary_validation, parseSummarySheet(workbook.Sheets[winSummaryName]!));
  }

  const newSummaryName = workbook.SheetNames.find((name) => NEW_REG_SUMMARY_PATTERN.test(name));
  if (newSummaryName) {
    const partial = parseSummarySheet(workbook.Sheets[newSummaryName]!);
    if (partial.new_reg_total_amount_million != null) {
      summary_validation.new_reg_total_amount_million = partial.new_reg_total_amount_million;
    }
    if (partial.new_reg_total_count != null) {
      summary_validation.new_reg_total_count = partial.new_reg_total_count;
    }
    if (partial.new_reg_partner_amount_million != null) {
      summary_validation.new_reg_partner_amount_million = partial.new_reg_partner_amount_million;
    }
    if (partial.new_reg_partner_count != null) {
      summary_validation.new_reg_partner_count = partial.new_reg_partner_count;
    }
  }

  const revenueSheetName =
    workbook.SheetNames.find((name) => REVENUE_PARTNER_SHEET_PATTERN.test(name)) ??
    workbook.SheetNames.find((name) => REVENUE_PIVOT_SHEET_PATTERN.test(name));

  const revenue_rows = revenueSheetName
    ? parseRevenueSheet(workbook.Sheets[revenueSheetName]!, revenueSheetName)
    : [];

  const required_columns_found = REQUIRED_KEYS.every((key) => columnMap[key] != null);

  if (!required_columns_found) {
    const missing = REQUIRED_KEYS.filter((key) => columnMap[key] == null);
    parse_errors.push(`필수 컬럼 누락: ${missing.join(", ")}`);
  }

  if (inventory_rows.filter((row) => row.project_code?.trim()).length === 0) {
    parse_errors.push("프로젝트코드가 있는 데이터 행이 없습니다.");
  }

  if (!snapshot_date) {
    const resolved = resolvePipelineSnapshotDate(sourceFileName, { sheetLabel: snapshot_label });
    snapshot_date = resolved.snapshot_date;
    snapshot_label = resolved.snapshot_label;
  }

  return {
    inventory_sheet_name: inventorySheetName ?? null,
    snapshot_label,
    snapshot_date,
    inventory_rows,
    revenue_rows,
    summary_validation,
    parse_errors,
    required_columns_found
  };
}

export function isWinForecastPartnerPipeline(row: ParsedInventoryRow): boolean {
  return row.is_product_revenue && row.is_partner_deal && isFy26(row.expected_win_year);
}

export function isNewRegPartnerPipeline(row: ParsedInventoryRow): boolean {
  return (
    row.is_product_revenue &&
    row.is_partner_deal &&
    isRegisteredYear2026(row.project_registered_year)
  );
}

export function isWinForecastTotalPipeline(row: ParsedInventoryRow): boolean {
  return row.is_product_revenue && isFy26(row.expected_win_year);
}

export function isNewRegTotalPipeline(row: ParsedInventoryRow): boolean {
  return row.is_product_revenue && isRegisteredYear2026(row.project_registered_year);
}

export function uniqueProjectCount(rows: ParsedInventoryRow[]): number {
  return new Set(rows.map((row) => row.project_code).filter(Boolean)).size;
}

export function sumProductAmount(rows: ParsedInventoryRow[]): number {
  return rows.reduce((sum, row) => sum + (row.product_amount_million ?? 0), 0);
}
