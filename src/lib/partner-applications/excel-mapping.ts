/**
 * Excel cell mapping for partner application workbook fill.
 * Keep all sheet/cell addresses here — never hardcode in UI components.
 *
 * Template: templates/partner-applications/partner-application-2026.xlsx
 * Base layout for sheets 0–1 follows the SPIS fixture / v7 신청서 구조.
 * Sheets 2–5 follow the documented sheet names; replace the template file
 * with the official v7 blank when available and adjust addresses if needed.
 */

export const PARTNER_APPLICATION_TEMPLATE_PATH =
  "templates/partner-applications/partner-application-2026.xlsx";

export const APPLICATION_SHEETS = {
  overviewSkip: ["파트너십 개요", "파트너 등록 안내", "자격"],
  application: "0. 파트너 신청서",
  staff: "1. 전담 인원",
  customers: "2. 주요고객 및 영업계획",
  strategy: "3. 영업전략",
  equipment: "4. 장비현황",
  engineerProfile1: "5. 기술인력프로필(1)",
  engineerProfile2: "5. 기술인력프로필(2)"
} as const;

/** Sheet 0 — company + primary contact */
export const APPLICATION_FORM_CELLS = {
  company_name: "D6",
  business_registration_number: "H6",
  representative_name: "D7",
  website: "H7",
  established_date: "D8",
  credit_grade: "H8",
  address: "D9",
  revenue: "H9",
  total_employees: "D10",
  dedicated_sales_count: "H10",
  total_engineers: "D11",
  dedicated_technical_count: "H11",
  contact_name: "D14",
  contact_position: "H14",
  contact_department: "D15",
  contact_office_phone: "H15",
  contact_phone: "D16",
  contact_email: "H16",
  technical_collaboration: "D18",
  platinum_review: "H18"
} as const;

/** Sheet 1 — dedicated staff repeating rows (1-based Excel rows) */
export const STAFF_SHEET_LAYOUT = {
  ceo: {
    headerRow: 2,
    startRow: 3,
    maxRows: 1,
    columns: {
      duty: "A",
      department: "B",
      name: "C",
      position: "D",
      phone: "E",
      email: "F",
      note: "G"
    }
  },
  sales: {
    headerRow: 5,
    startRow: 6,
    maxRows: 10,
    columns: {
      duty: "A",
      department: "B",
      name: "C",
      position: "D",
      phone: "E",
      email: "F",
      note: "G"
    }
  },
  engineer: {
    headerRow: 17,
    startRow: 18,
    maxRows: 10,
    columns: {
      duty: "A",
      department: "B",
      name: "C",
      position: "D",
      phone: "E",
      email: "F",
      note: "G",
      skill_level: "H",
      main_skills: "I"
    }
  }
} as const;

/** Sheet 2 — major customers / sales plan */
export const CUSTOMERS_SHEET_LAYOUT = {
  headerRow: 2,
  startRow: 3,
  maxRows: 20,
  columns: {
    customer_name: "A",
    proposal_status: "B",
    business_timing: "C",
    revenue_target: "D",
    note: "E"
  },
  appendixSheetName: "2. 주요고객 (부록)"
} as const;

/** Sheet 3 — free-text sales strategy */
export const STRATEGY_SHEET_CELLS = {
  body: "A2"
} as const;

/** Sheet 4 — equipment */
export const EQUIPMENT_SHEET_LAYOUT = {
  headerRow: 2,
  startRow: 3,
  maxRows: 20,
  columns: {
    equipment_name: "A",
    model: "B",
    quantity: "C",
    note: "D"
  },
  appendixSheetName: "4. 장비현황 (부록)"
} as const;

/** Sheets 5 — engineer profiles */
export const ENGINEER_PROFILE_LAYOUT = {
  headerRow: 2,
  startRow: 3,
  maxRows: 10,
  columns: {
    name: "A",
    career_years: "B",
    main_skills: "C",
    certifications: "D",
    note: "E"
  },
  appendixSheetName: "5. 기술인력프로필 (부록)"
} as const;

export const EXCEL_LIMITS = {
  salesStaff: STAFF_SHEET_LAYOUT.sales.maxRows,
  engineerStaff: STAFF_SHEET_LAYOUT.engineer.maxRows,
  customers: CUSTOMERS_SHEET_LAYOUT.maxRows,
  equipment: EQUIPMENT_SHEET_LAYOUT.maxRows,
  engineerProfilesPerSheet: ENGINEER_PROFILE_LAYOUT.maxRows
} as const;
