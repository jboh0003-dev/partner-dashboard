import * as XLSX from "xlsx";
import { parsePhoneFromCell } from "@/lib/contacts/phone-normalize";
import { normalizeContractCompanyName } from "@/lib/partner-application/contract-dates";
import { normalizeApplicationDate } from "@/lib/partner-application/normalize-application-date";

export type ApplicationPerson = {
  section: "contract_contact" | "sales" | "engineer";
  duty: string | null;
  department: string | null;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  skill_level: string | null;
  main_skills: string | null;
  excluded?: boolean;
};

export type PartnerApplicationParseResult = {
  ok: boolean;
  warnings: string[];
  errors: string[];
  company: {
    company_name_raw: string | null;
    company_name_db: string | null;
    company_name_contract: string | null;
    business_number: string | null;
    ceo_name: string | null;
    website: string | null;
    /** 화면 표시용 (예: 2021년 1월) */
    founded_date: string | null;
    /** DB 저장용 YYYY-MM-DD */
    founded_date_iso: string | null;
    credit_rating: string | null;
    address: string | null;
    revenue: string | null;
    employee_count: string | null;
    engineer_count: string | null;
    dedicated_sales_count: string | null;
    dedicated_engineer_count: string | null;
    application_date: string | null;
    applicant_name: string | null;
  };
  contract_contact: ApplicationPerson | null;
  sales_staff: ApplicationPerson[];
  engineer_staff: ApplicationPerson[];
};

function cellText(sheet: XLSX.WorkSheet, addr: string): string | null {
  const cell = sheet[addr];
  if (!cell) return null;
  const value = cell.w ?? cell.v;
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function cellRaw(sheet: XLSX.WorkSheet, addr: string): unknown {
  const cell = sheet[addr];
  if (!cell) return null;
  return cell.v ?? cell.w ?? null;
}

function readRawByLabel(
  sheet: XLSX.WorkSheet,
  labels: string[],
  fallbackAddr?: string
): unknown {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:Z40");
  for (let r = range.s.r; r <= Math.min(range.e.r, 40); r += 1) {
    for (let c = range.s.c; c <= Math.min(range.e.c, 20); c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const label = cellText(sheet, addr);
      if (!label) continue;
      const compact = label.replace(/\s+/g, "");
      if (!labels.some((l) => compact.includes(l.replace(/\s+/g, "")))) continue;
      for (const dc of [1, 2, 3, 4]) {
        const valueAddr = XLSX.utils.encode_cell({ r, c: c + dc });
        const raw = cellRaw(sheet, valueAddr);
        const text = cellText(sheet, valueAddr);
        if (
          raw != null &&
          text &&
          !labels.some((l) => text.replace(/\s+/g, "").includes(l.replace(/\s+/g, "")))
        ) {
          return raw;
        }
      }
    }
  }
  return fallbackAddr ? cellRaw(sheet, fallbackAddr) : null;
}

function normalizeSheetName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

function findSheet(workbook: XLSX.WorkBook, hints: string[]): XLSX.WorkSheet | null {
  const normalizedHints = hints.map((h) => normalizeSheetName(h));
  for (const sheetName of workbook.SheetNames) {
    const norm = normalizeSheetName(sheetName);
    if (normalizedHints.some((hint) => norm.includes(hint) || hint.includes(norm))) {
      return workbook.Sheets[sheetName] ?? null;
    }
  }
  return null;
}

function readByLabel(
  sheet: XLSX.WorkSheet,
  labels: string[],
  fallbackAddr?: string
): string | null {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:Z40");
  for (let r = range.s.r; r <= Math.min(range.e.r, 40); r += 1) {
    for (let c = range.s.c; c <= Math.min(range.e.c, 20); c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const label = cellText(sheet, addr);
      if (!label) continue;
      const compact = label.replace(/\s+/g, "");
      if (!labels.some((l) => compact.includes(l.replace(/\s+/g, "")))) continue;
      // value usually to the right
      for (const dc of [1, 2, 3, 4]) {
        const valueAddr = XLSX.utils.encode_cell({ r, c: c + dc });
        const value = cellText(sheet, valueAddr);
        if (value && !labels.some((l) => value.replace(/\s+/g, "").includes(l.replace(/\s+/g, "")))) {
          return value;
        }
      }
    }
  }
  return fallbackAddr ? cellText(sheet, fallbackAddr) : null;
}

function readApplicationDateByLabel(
  sheet: XLSX.WorkSheet,
  labels: string[],
  fallbackAddr?: string
): { display: string | null; iso: string | null; warning?: string } {
  const raw = readRawByLabel(sheet, labels, fallbackAddr);
  if (raw == null || raw === "") {
    return { display: null, iso: null };
  }
  // Excel date serial via SheetJS when typed as number/date
  if (typeof raw === "number" && Number.isFinite(raw) && fallbackAddr) {
    const cell = sheet[fallbackAddr];
    if (cell?.t === "n" || cell?.t === "d") {
      const parsed = XLSX.SSF.parse_date_code(raw);
      if (parsed) {
        const iso = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        return {
          display: `${parsed.y}년 ${parsed.m}월 ${parsed.d}일`,
          iso
        };
      }
    }
  }
  const normalized = normalizeApplicationDate(raw);
  if (!normalized.ok) {
    return {
      display: normalized.display,
      iso: null,
      warning: "설립일자 검토 필요"
    };
  }
  return {
    display: normalized.display,
    iso: normalized.iso
  };
}

function normalizePersonPhone(value: unknown): string | null {
  return parsePhoneFromCell(value);
}

function parseStaffSection(
  sheet: XLSX.WorkSheet,
  sectionLabel: string,
  section: "sales" | "engineer"
): ApplicationPerson[] {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:Z80");
  let headerRow = -1;
  let sectionStarted = false;

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= Math.min(range.e.c, 12); c += 1) {
      const text = cellText(sheet, XLSX.utils.encode_cell({ r, c }));
      if (!text) continue;
      if (text.replace(/\s+/g, "").includes(sectionLabel.replace(/\s+/g, ""))) {
        sectionStarted = true;
      }
      if (sectionStarted && /이름|성명/.test(text) && /부서|직급|휴대폰|이메일/.test(
        Array.from({ length: 8 }, (_, i) =>
          cellText(sheet, XLSX.utils.encode_cell({ r, c: i })) ?? ""
        ).join(" ")
      )) {
        headerRow = r;
        break;
      }
    }
    if (headerRow >= 0) break;
  }

  if (headerRow < 0) return [];

  const headerCells: Array<{ c: number; label: string }> = [];
  for (let c = range.s.c; c <= Math.min(range.e.c, 15); c += 1) {
    const label = cellText(sheet, XLSX.utils.encode_cell({ r: headerRow, c }));
    if (label) headerCells.push({ c, label });
  }

  function col(...names: string[]): number | null {
    const found = headerCells.find((h) => names.some((n) => h.label.replace(/\s+/g, "").includes(n)));
    return found ? found.c : null;
  }

  const dutyCol = col("담당업무", "업무");
  const deptCol = col("부서");
  const nameCol = col("이름", "성명");
  const positionCol = col("직급", "직책");
  const phoneCol = col("휴대폰", "연락처", "전화");
  const emailCol = col("이메일", "메일");
  const noteCol = col("비고");
  const skillCol = col("숙련");
  const mainSkillCol = col("주요기술", "기술");

  if (nameCol == null) return [];

  const people: ApplicationPerson[] = [];
  for (let r = headerRow + 1; r <= Math.min(headerRow + 30, range.e.r); r += 1) {
    const first = cellText(sheet, XLSX.utils.encode_cell({ r, c: 0 })) ?? "";
    if (/전담인원|합계|계\s*$/.test(first.replace(/\s+/g, "")) && r > headerRow + 1) break;
    // next section
    let rowJoined = "";
    for (let c = 0; c <= 8; c += 1) {
      rowJoined += cellText(sheet, XLSX.utils.encode_cell({ r, c })) ?? "";
    }
    if (
      section === "sales" &&
      rowJoined.replace(/\s+/g, "").includes("기술전담") &&
      r > headerRow + 1
    ) {
      break;
    }

    const name = cellText(sheet, XLSX.utils.encode_cell({ r, c: nameCol }));
    if (!name || /이름|성명|해당없음|없음/.test(name)) continue;

    people.push({
      section,
      duty: dutyCol != null ? cellText(sheet, XLSX.utils.encode_cell({ r, c: dutyCol })) : null,
      department: deptCol != null ? cellText(sheet, XLSX.utils.encode_cell({ r, c: deptCol })) : null,
      name,
      position:
        positionCol != null ? cellText(sheet, XLSX.utils.encode_cell({ r, c: positionCol })) : null,
      phone:
        phoneCol != null
          ? normalizePersonPhone(cellRaw(sheet, XLSX.utils.encode_cell({ r, c: phoneCol })))
          : null,
      email: emailCol != null ? cellText(sheet, XLSX.utils.encode_cell({ r, c: emailCol })) : null,
      note: noteCol != null ? cellText(sheet, XLSX.utils.encode_cell({ r, c: noteCol })) : null,
      skill_level:
        skillCol != null ? cellText(sheet, XLSX.utils.encode_cell({ r, c: skillCol })) : null,
      main_skills:
        mainSkillCol != null
          ? cellText(sheet, XLSX.utils.encode_cell({ r, c: mainSkillCol }))
          : null
    });
  }

  return people;
}

export function parsePartnerApplicationWorkbook(workbook: XLSX.WorkBook): PartnerApplicationParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const appSheet = findSheet(workbook, ["0.파트너신청서", "파트너신청서", "신청서"]);
  const staffSheet = findSheet(workbook, ["1.전담인원", "전담인원", "전담"]);

  if (!appSheet) errors.push("필수 시트 '0. 파트너 신청서'를 찾을 수 없습니다.");
  if (!staffSheet) errors.push("필수 시트 '1. 전담 인원'을 찾을 수 없습니다.");

  if (!appSheet) {
    return {
      ok: false,
      warnings,
      errors,
      company: emptyCompany(),
      contract_contact: null,
      sales_staff: [],
      engineer_staff: []
    };
  }

  const company_name_raw =
    readByLabel(appSheet, ["기업명", "회사명", "상호"], "D6") ?? cellText(appSheet, "D6");
  const business_number =
    readByLabel(appSheet, ["사업자등록번호", "사업자번호"], "H6") ?? cellText(appSheet, "H6");
  const ceo_name =
    readByLabel(appSheet, ["대표자명", "대표자", "대표이사"], "D7") ?? cellText(appSheet, "D7");
  const website =
    readByLabel(appSheet, ["홈페이지", "웹사이트"], "H7") ?? cellText(appSheet, "H7");
  const founded = readApplicationDateByLabel(appSheet, ["설립일자", "설립일"], "D8");
  if (founded.warning) warnings.push(founded.warning);
  const credit_rating =
    readByLabel(appSheet, ["신용등급"], "H8") ?? cellText(appSheet, "H8");
  const address = readByLabel(appSheet, ["주소"], "D9") ?? cellText(appSheet, "D9");
  const revenue = readByLabel(appSheet, ["매출액"], "H9") ?? cellText(appSheet, "H9");
  const employee_count =
    readByLabel(appSheet, ["전체임직원", "임직원"], "D10") ?? cellText(appSheet, "D10");
  const dedicated_sales_count =
    readByLabel(appSheet, ["전담영업", "영업인원"], "H10") ?? cellText(appSheet, "H10");
  const engineer_count =
    readByLabel(appSheet, ["전체엔지니어", "엔지니어"], "D11") ?? cellText(appSheet, "D11");
  const dedicated_engineer_count =
    readByLabel(appSheet, ["전담기술", "기술인원"], "H11") ?? cellText(appSheet, "H11");
  const applicationDate = readApplicationDateByLabel(appSheet, ["신청일"], "D20");
  const applicant_name = readByLabel(appSheet, ["신청자"]);

  const contactName =
    readByLabel(appSheet, ["성명"], "D14") ?? cellText(appSheet, "D14");
  const contactPosition =
    readByLabel(appSheet, ["직급", "직책"], "H14") ?? cellText(appSheet, "H14");
  const contactDepartment =
    readByLabel(appSheet, ["부서"], "D15") ?? cellText(appSheet, "D15");
  const contactDirect =
    normalizePersonPhone(readRawByLabel(appSheet, ["직통"], "H15") ?? cellRaw(appSheet, "H15"));
  const contactMobile =
    normalizePersonPhone(readRawByLabel(appSheet, ["휴대폰"], "D16") ?? cellRaw(appSheet, "D16"));
  const contactEmail =
    readByLabel(appSheet, ["이메일"], "H16") ?? cellText(appSheet, "H16");

  if (!company_name_raw) {
    errors.push("기업명이 비어 있습니다.");
    warnings.push("기업명 검토 필요");
  }
  if (!business_number) warnings.push("사업자등록번호 검토 필요");
  if (!ceo_name) warnings.push("대표자명 검토 필요");
  if (!contactName) warnings.push("담당자 성명 검토 필요");

  const contract_contact: ApplicationPerson | null = contactName
    ? {
        section: "contract_contact",
        duty: "계약담당",
        department: contactDepartment,
        name: contactName,
        position: contactPosition,
        phone: contactMobile ?? contactDirect,
        email: contactEmail,
        note: contactDirect && contactDirect !== contactMobile ? `직통 ${contactDirect}` : null,
        skill_level: null,
        main_skills: null
      }
    : null;

  const sales_staff = staffSheet ? parseStaffSection(staffSheet, "영업전담", "sales") : [];
  const engineer_staff = staffSheet
    ? parseStaffSection(staffSheet, "기술전담", "engineer")
    : [];

  if (staffSheet && sales_staff.length === 0) warnings.push("영업 전담인원을 찾지 못했습니다.");
  if (staffSheet && engineer_staff.length === 0) warnings.push("기술 전담인원을 찾지 못했습니다.");

  return {
    ok: errors.length === 0,
    warnings,
    errors,
    company: {
      company_name_raw,
      company_name_db: company_name_raw,
      company_name_contract: company_name_raw
        ? normalizeContractCompanyName(company_name_raw)
        : null,
      business_number,
      ceo_name,
      website,
      founded_date: founded.display,
      founded_date_iso: founded.iso,
      credit_rating,
      address,
      revenue,
      employee_count,
      engineer_count,
      dedicated_sales_count,
      dedicated_engineer_count,
      application_date: applicationDate.display ?? applicationDate.iso,
      applicant_name
    },
    contract_contact,
    sales_staff,
    engineer_staff
  };
}

function emptyCompany(): PartnerApplicationParseResult["company"] {
  return {
    company_name_raw: null,
    company_name_db: null,
    company_name_contract: null,
    business_number: null,
    ceo_name: null,
    website: null,
    founded_date: null,
    founded_date_iso: null,
    credit_rating: null,
    address: null,
    revenue: null,
    employee_count: null,
    engineer_count: null,
    dedicated_sales_count: null,
    dedicated_engineer_count: null,
    application_date: null,
    applicant_name: null
  };
}

export function parsePartnerApplicationBuffer(buffer: ArrayBuffer | Buffer): PartnerApplicationParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return parsePartnerApplicationWorkbook(workbook);
}
