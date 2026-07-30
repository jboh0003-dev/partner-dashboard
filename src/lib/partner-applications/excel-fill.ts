import ExcelJS from "exceljs";
import { readFile } from "fs/promises";
import path from "path";
import {
  APPLICATION_FORM_CELLS,
  APPLICATION_SHEETS,
  CUSTOMERS_SHEET_LAYOUT,
  ENGINEER_PROFILE_LAYOUT,
  EQUIPMENT_SHEET_LAYOUT,
  PARTNER_APPLICATION_TEMPLATE_PATH,
  STAFF_SHEET_LAYOUT,
  STRATEGY_SHEET_CELLS
} from "@/lib/partner-applications/excel-mapping";
import type { PartnerApplicationFormPayload } from "@/lib/partner-applications/types";

function setCell(
  sheet: ExcelJS.Worksheet,
  address: string,
  value: string | number | null | undefined
) {
  if (value == null || value === "") return;
  const cell = sheet.getCell(address);
  cell.value = typeof value === "number" ? value : String(value);
}

function colRow(col: string, row: number): string {
  return `${col}${row}`;
}

function fillStaffSection(
  sheet: ExcelJS.Worksheet,
  layout: (typeof STAFF_SHEET_LAYOUT)[keyof typeof STAFF_SHEET_LAYOUT],
  rows: PartnerApplicationFormPayload["people"]["sales"]
) {
  const limited = rows.slice(0, layout.maxRows);
  limited.forEach((person, i) => {
    const r = layout.startRow + i;
    const cols = layout.columns as Record<string, string>;
    if (cols.duty) setCell(sheet, colRow(cols.duty, r), person.duty);
    if (cols.department) setCell(sheet, colRow(cols.department, r), person.department);
    if (cols.name) setCell(sheet, colRow(cols.name, r), person.name);
    if (cols.position) setCell(sheet, colRow(cols.position, r), person.position);
    if (cols.phone) setCell(sheet, colRow(cols.phone, r), person.phone);
    if (cols.email) setCell(sheet, colRow(cols.email, r), person.email);
    if (cols.note) setCell(sheet, colRow(cols.note, r), person.note);
    if ("skill_level" in cols && cols.skill_level) {
      setCell(sheet, colRow(cols.skill_level, r), person.skill_level);
    }
    if ("main_skills" in cols && cols.main_skills) {
      setCell(sheet, colRow(cols.main_skills, r), person.main_skills);
    }
  });
}

function fillTableRows<T extends Record<string, unknown>>(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  maxRows: number,
  columns: Record<string, string>,
  rows: T[],
  fieldMap: Array<[keyof T & string, string]>
) {
  rows.slice(0, maxRows).forEach((row, i) => {
    const r = startRow + i;
    for (const [field, colKey] of fieldMap) {
      const col = columns[colKey];
      if (!col) continue;
      const v = row[field];
      setCell(sheet, colRow(col, r), v == null ? "" : String(v));
    }
  });
}

function ensureAppendixSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[]
): ExcelJS.Worksheet {
  let sheet = workbook.getWorksheet(name);
  if (!sheet) {
    sheet = workbook.addWorksheet(name);
    headers.forEach((h, i) => {
      sheet!.getCell(1, i + 1).value = h;
    });
  }
  return sheet;
}

/**
 * Clone template in memory and fill application values.
 * Does not mutate the on-disk template. Does not upload to Storage.
 */
export async function fillPartnerApplicationExcel(
  form: PartnerApplicationFormPayload
): Promise<Buffer> {
  const templatePath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    PARTNER_APPLICATION_TEMPLATE_PATH
  );
  const templateBuf = await readFile(templatePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuf as unknown as ExcelJS.Buffer);

  const appSheet = workbook.getWorksheet(APPLICATION_SHEETS.application);
  if (!appSheet) throw new Error("템플릿에 '0. 파트너 신청서' 시트가 없습니다.");

  const cells = APPLICATION_FORM_CELLS;
  const c = form.company;
  setCell(appSheet, cells.company_name, c.company_name);
  setCell(appSheet, cells.business_registration_number, c.business_registration_number);
  setCell(appSheet, cells.representative_name, c.representative_name);
  setCell(appSheet, cells.website, c.website);
  setCell(appSheet, cells.established_date, c.established_date);
  setCell(appSheet, cells.credit_grade, c.credit_grade);
  setCell(appSheet, cells.address, c.address);
  setCell(appSheet, cells.revenue, c.revenue);
  setCell(appSheet, cells.total_employees, c.total_employees);
  setCell(appSheet, cells.dedicated_sales_count, c.dedicated_sales_count);
  setCell(appSheet, cells.total_engineers, c.total_engineers);
  setCell(appSheet, cells.dedicated_technical_count, c.dedicated_technical_count);

  const ct = form.contact;
  setCell(appSheet, cells.contact_name, ct.name);
  setCell(appSheet, cells.contact_position, ct.position);
  setCell(appSheet, cells.contact_department, ct.department);
  setCell(appSheet, cells.contact_office_phone, ct.office_phone);
  setCell(appSheet, cells.contact_phone, ct.phone);
  setCell(appSheet, cells.contact_email, ct.email);
  setCell(
    appSheet,
    cells.technical_collaboration,
    form.flags.technical_collaboration_requested ? "Y" : ""
  );
  setCell(
    appSheet,
    cells.platinum_review,
    form.flags.platinum_review_requested ? "Y" : ""
  );

  const staffSheet = workbook.getWorksheet(APPLICATION_SHEETS.staff);
  if (staffSheet) {
    fillStaffSection(staffSheet, STAFF_SHEET_LAYOUT.ceo, form.people.ceo);
    fillStaffSection(staffSheet, STAFF_SHEET_LAYOUT.sales, form.people.sales);
    fillStaffSection(staffSheet, STAFF_SHEET_LAYOUT.engineer, form.people.engineer);
  }

  const customersSheet = workbook.getWorksheet(APPLICATION_SHEETS.customers);
  if (customersSheet) {
    const layout = CUSTOMERS_SHEET_LAYOUT;
    const inRange = form.customers.slice(0, layout.maxRows);
    fillTableRows(customersSheet, layout.startRow, layout.maxRows, layout.columns, inRange, [
      ["customer_name", "customer_name"],
      ["proposal_status", "proposal_status"],
      ["business_timing", "business_timing"],
      ["revenue_target", "revenue_target"],
      ["note", "note"]
    ]);
    const overflow = form.customers.slice(layout.maxRows);
    if (overflow.length) {
      const appendix = ensureAppendixSheet(workbook, layout.appendixSheetName, [
        "고객명",
        "제안 상황",
        "사업 시기",
        "매출 목표",
        "비고"
      ]);
      overflow.forEach((row, i) => {
        appendix.getCell(i + 2, 1).value = row.customer_name ?? "";
        appendix.getCell(i + 2, 2).value = row.proposal_status ?? "";
        appendix.getCell(i + 2, 3).value = row.business_timing ?? "";
        appendix.getCell(i + 2, 4).value = row.revenue_target ?? "";
        appendix.getCell(i + 2, 5).value = row.note ?? "";
      });
    }
  }

  const strategySheet = workbook.getWorksheet(APPLICATION_SHEETS.strategy);
  if (strategySheet) {
    setCell(strategySheet, STRATEGY_SHEET_CELLS.body, form.sales_strategy);
  }

  const equipmentSheet = workbook.getWorksheet(APPLICATION_SHEETS.equipment);
  if (equipmentSheet) {
    const layout = EQUIPMENT_SHEET_LAYOUT;
    fillTableRows(
      equipmentSheet,
      layout.startRow,
      layout.maxRows,
      layout.columns,
      form.equipment,
      [
        ["equipment_name", "equipment_name"],
        ["model", "model"],
        ["quantity", "quantity"],
        ["note", "note"]
      ]
    );
    const overflow = form.equipment.slice(layout.maxRows);
    if (overflow.length) {
      const appendix = ensureAppendixSheet(workbook, layout.appendixSheetName, [
        "장비명",
        "모델",
        "수량",
        "비고"
      ]);
      overflow.forEach((row, i) => {
        appendix.getCell(i + 2, 1).value = row.equipment_name ?? "";
        appendix.getCell(i + 2, 2).value = row.model ?? "";
        appendix.getCell(i + 2, 3).value = row.quantity ?? "";
        appendix.getCell(i + 2, 4).value = row.note ?? "";
      });
    }
  }

  const profiles1 = form.engineer_profiles.filter((p) => (p.profile_sheet ?? 1) === 1);
  const profiles2 = form.engineer_profiles.filter((p) => p.profile_sheet === 2);
  const layout = ENGINEER_PROFILE_LAYOUT;

  for (const [sheetName, rows] of [
    [APPLICATION_SHEETS.engineerProfile1, profiles1] as const,
    [APPLICATION_SHEETS.engineerProfile2, profiles2] as const
  ]) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;
    fillTableRows(sheet, layout.startRow, layout.maxRows, layout.columns, rows, [
      ["name", "name"],
      ["career_years", "career_years"],
      ["main_skills", "main_skills"],
      ["certifications", "certifications"],
      ["note", "note"]
    ]);
  }

  const allOverflow = [
    ...profiles1.slice(layout.maxRows),
    ...profiles2.slice(layout.maxRows)
  ];
  if (allOverflow.length) {
    const appendix = ensureAppendixSheet(workbook, layout.appendixSheetName, [
      "이름",
      "경력(년)",
      "주요기술",
      "자격증",
      "비고"
    ]);
    allOverflow.forEach((row, i) => {
      appendix.getCell(i + 2, 1).value = row.name ?? "";
      appendix.getCell(i + 2, 2).value = row.career_years ?? "";
      appendix.getCell(i + 2, 3).value = row.main_skills ?? "";
      appendix.getCell(i + 2, 4).value = row.certifications ?? "";
      appendix.getCell(i + 2, 5).value = row.note ?? "";
    });
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out);
}

export function buildApplicationExcelFileName(companyName: string): string {
  const safe = (companyName || "미기재").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80);
  return `2026년_오케스트로_파트너_신청서_${safe}.xlsx`;
}
