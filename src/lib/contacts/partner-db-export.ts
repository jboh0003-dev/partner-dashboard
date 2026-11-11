import ExcelJS from "exceljs";
import { comparePartnerNo } from "@/lib/partners/partner-no";
import type { PersonContactRow } from "@/lib/contacts/person-groups";

/** The first 16 headings and all A:Y column widths are taken from the user's original 파트너DB(1).xlsx. */
const HEADINGS: (string | null)[] = [
  "No", "계약일자", "등급", "등급(예정)", "광역그룹(임시)", "계약담당자", "회사명", "담당 업무",
  "업무상세", "부서", "계약 담당자이름", "직급", "연락처", "포컬포인트", "비고", "담당자 이메일",
  null, null, null, null, null, null, null, null, null
];
const WIDTHS = [
  9.625, 16.25, 4.5, 15.25, 13.5, 5.125, 20.25, 10.75, 28, 13.75, 10.125,
  8.125, 13.25, 13.25, 18.125, 29.625, 12.5, 8.75, 13, 13, 13, 13, 13, 21.25, 8.75
];
const BLACK = "FF000000";
const WHITE = "FFFFFFFF";
const GREEN = "FF00B050";
const RED = "FFFF0000";
const HEADER_FILLS = [
  BLACK, BLACK, BLACK, GREEN, GREEN, GREEN, RED, BLACK, RED, BLACK, BLACK, BLACK, BLACK, RED, RED, BLACK
];

export type PartnerDbMetadata = {
  id: string;
  external_no?: string | null;
  grade?: string | null;
  grade_original?: string | null;
  grade_override?: string | null;
  grade_change_raw?: string | null;
  contract_start_date?: string | null;
  contract_contact_name?: string | null;
  region_group?: string | null;
};

function gradeLabel(raw: string | null | undefined): string {
  const normalized = (raw ?? "").trim().toLowerCase();
  const labels: Record<string, string> = {
    platinum: "플래티넘", gold: "골드", silver: "실버"
  };
  return labels[normalized] ?? (raw ?? "").trim();
}

function plannedGrade(partner?: PartnerDbMetadata): string {
  if (!partner) return "";
  const change = (partner.grade_change_raw ?? "").trim();
  const match = change.match(/(플래티넘|골드|실버)\s*변경\s*예정/);
  if (match) return match[1]!;
  if (/^(플래티넘|골드|실버|platinum|gold|silver)$/i.test(change)) return gradeLabel(change);
  return gradeLabel(partner.grade_override || partner.grade || partner.grade_original);
}

function contactRole(row: PersonContactRow): string {
  const explicit = (row.role_raw ?? "").trim();
  if (/영업|sales|pre.?sales/i.test(explicit)) return "영업";
  if (/기술|엔지니어|engineer/i.test(explicit)) return "기술";
  if (/대표/.test(explicit)) return "대표";
  if (row.role_type === "sales") return "영업";
  if (row.role_type === "engineer") return "기술";
  if (row.role_type === "executive") return "대표";
  if (row.role_type === "admin") return "관리";
  return explicit && explicit !== "etc" && explicit !== "contract" ? explicit : "";
}

function contractDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return date ? date[1] + "." + date[2] + "." + date[3] : value;
}

function companyPartnerNumber(value: string | null | undefined): string | number {
  const input = (value ?? "").trim();
  if (!input) return "";
  return /^\d+$/.test(input) && !(input.length > 1 && input.startsWith("0")) ? Number(input) : input;
}

export function buildPartnerDbWorkbook(
  contacts: PersonContactRow[],
  partners: Map<string, PartnerDbMetadata>,
  focalContactIds: ReadonlySet<string> = new Set()
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Partner Connect";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("파트너 DB_오재복", {
    properties: { defaultRowHeight: 15.6, defaultColWidth: 8.75 },
    views: [{ state: "frozen", xSplit: 0, ySplit: 209, topLeftCell: "A210" }]
  });
  sheet.showGridLines = true;
  WIDTHS.forEach((width, i) => { sheet.getColumn(i + 1).width = width; });
  const header = sheet.getRow(1);
  header.height = 24;
  for (let i = 0; i < HEADINGS.length; i++) {
    const cell = header.getCell(i + 1);
    cell.value = HEADINGS[i];
    if (i >= 16) {
      cell.font = { name: "맑은 고딕", size: i === 16 ? 10 : 11, color: { theme: 1 } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      continue;
    }
    cell.font = { name: "맑은 고딕", size: 10, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILLS[i] } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" }
    };
  }

  const ordered = [...contacts].sort((a, b) => {
    const n = comparePartnerNo(a.partner_no, b.partner_no);
    if (n !== 0) return n;
    const p = Number(b.is_contract_contact) - Number(a.is_contract_contact);
    return p || a.name.localeCompare(b.name, "ko-KR");
  });

  for (let index = 0; index < ordered.length; index++) {
    const row = ordered[index]!;
    const partner = partners.get(row.partner_id);
    const isContractContact = row.is_contract_contact
      || Boolean(partner?.contract_contact_name && partner.contract_contact_name.trim() === row.name.trim());
    const values: (string | number | null)[] = [
      companyPartnerNumber(row.partner_no), contractDate(partner?.contract_start_date),
      gradeLabel(partner?.grade_override || partner?.grade || partner?.grade_original),
      plannedGrade(partner), row.region_group ?? partner?.region_group ?? "",
      isContractContact ? "O" : null, row.company_name, contactRole(row), null,
      row.department ?? "", row.name, row.position ?? "",
      row.display_phone || row.phone || "", focalContactIds.has(row.id) ? "O" : null,
      row.memo || null, row.email || ""
    ];
    const excelRow = sheet.getRow(index + 2);
    excelRow.height = 15.6;
    for (let col = 1; col <= HEADINGS.length; col++) {
      const cell = excelRow.getCell(col);
      cell.value = values[col - 1] ?? null;
      cell.font = { name: "맑은 고딕", size: col >= 18 ? 11 : 10, color: { argb: BLACK } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      if (col <= 16) {
        cell.border = {
          top: { style: "thin" }, bottom: { style: "thin" },
          left: { style: "thin" }, right: { style: "thin" }
        };
      }
    }
  }
  sheet.autoFilter = { from: "A1", to: "Y" + String(ordered.length + 1) };
  return workbook;
}
