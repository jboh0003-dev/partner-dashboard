import {
  formatAttendanceStatus,
  formatTrainingYearMonth,
  isTechPartnerTraining,
  parseTrainingGroupKey
} from "@/lib/training-display";

export const EDUCATION_STATUS_EMPTY_MESSAGE = "다운로드할 교육 데이터가 없습니다.";

export const EDUCATION_STATUS_EXPORT_HEADERS = [
  "교육일자",
  "교육월",
  "교육과정",
  "파트너사",
  "참석자명",
  "직함/부서",
  "연락처",
  "이메일",
  "참석상태",
  "수료여부",
  "비고"
] as const;

export const EDUCATION_STATUS_ATTENDANCE_SELECT =
  "id, training_id, partner_id, attendee_name, attendee_department, attendee_position, attendee_phone, attendee_email, attended, attendance_status, completion_status, score, evaluation_result, note, evaluation_memo, company_name_raw, partner:partners(company_name), training:trainings(training_name, training_type, training_level, product, product_name, training_year, training_month, start_date, end_date)";

export type EducationStatusFilters = {
  q?: string;
  month?: string;
  training?: string;
};

export type EducationStatusAttendeeRow = {
  id: string;
  training_id: string;
  partner_id: string | null;
  partner_name: string;
  is_non_partner: boolean;
  attendee_name: string;
  training_year: number | null;
  training_month: number | null;
  training_start_date: string | null;
  training_end_date: string | null;
  training_name: string;
  training_type: string | null;
  training_level: string | null;
  product: string | null;
  attendee_position: string | null;
  attendee_department: string | null;
  attendee_phone: string | null;
  attendee_email: string | null;
  attended: boolean;
  attendance_status: string | null;
  completion_status: string | null;
  score: number | null;
  evaluation_result: string | null;
  note: string | null;
};

type FlattenSourceRow = {
  id: string;
  training_id: string;
  partner_id?: string | null;
  company_name_raw?: string | null;
  attendee_name: string | null;
  attendee_department: string | null;
  attendee_position: string | null;
  attendee_phone: string | null;
  attendee_email: string | null;
  attended: boolean;
  attendance_status: string | null;
  completion_status: string | null;
  score: number | null;
  evaluation_result: string | null;
  note: string | null;
  evaluation_memo: string | null;
  partner: { company_name: string } | Array<{ company_name: string }> | null;
  training:
    | {
        training_name: string;
        training_type: string | null;
        training_level: string | null;
        product: string | null;
        product_name: string | null;
        training_year: number | null;
        training_month: number | null;
        start_date: string | null;
        end_date: string | null;
      }
    | Array<{
        training_name: string;
        training_type: string | null;
        training_level: string | null;
        product: string | null;
        product_name: string | null;
        training_year: number | null;
        training_month: number | null;
        start_date: string | null;
        end_date: string | null;
      }>
    | null;
};

export type EducationStatusExcelRow = Record<
  (typeof EDUCATION_STATUS_EXPORT_HEADERS)[number],
  string
>;

export function flattenAttendeeRows(data: unknown): EducationStatusAttendeeRow[] {
  if (!Array.isArray(data)) return [];

  return (data as FlattenSourceRow[]).map((row) => {
    const partner = Array.isArray(row.partner) ? row.partner[0] ?? null : row.partner;
    const training = Array.isArray(row.training) ? row.training[0] ?? null : row.training;
    const is_non_partner = !row.partner_id;
    const partner_name = partner?.company_name ?? row.company_name_raw?.trim() ?? "-";

    return {
      id: row.id,
      training_id: row.training_id,
      partner_id: row.partner_id ?? null,
      partner_name,
      is_non_partner,
      attendee_name: row.attendee_name?.trim() || "-",
      training_year: training?.training_year ?? null,
      training_month: training?.training_month ?? null,
      training_start_date: training?.start_date ?? null,
      training_end_date: training?.end_date ?? null,
      training_name: training?.training_name ?? "-",
      training_type: training?.training_type ?? null,
      training_level: training?.training_level ?? null,
      product: training?.product ?? training?.product_name ?? null,
      attendee_position: row.attendee_position,
      attendee_department: row.attendee_department,
      attendee_phone: row.attendee_phone,
      attendee_email: row.attendee_email,
      attended: row.attended,
      attendance_status: row.attendance_status,
      completion_status: row.completion_status,
      score: row.score,
      evaluation_result: row.evaluation_result,
      note: row.note ?? row.evaluation_memo
    };
  });
}

export function filterEducationStatusAttendees(
  rows: EducationStatusAttendeeRow[],
  params: EducationStatusFilters
): EducationStatusAttendeeRow[] {
  const q = (params.q ?? "").trim().toLowerCase();
  const month = params.month ?? "all";
  const training = params.training ?? "all";

  return rows.filter((row) => {
    if (q) {
      const haystack = [row.partner_name, row.attendee_name, row.training_name, row.attendee_email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (month !== "all") {
      const parsed = parseTrainingGroupKey(month);
      if (
        !parsed ||
        row.training_year !== parsed.year ||
        row.training_month !== parsed.month ||
        isTechPartnerTraining(row) !== parsed.isTech
      ) {
        return false;
      }

      if (training !== "all" && row.training_id !== training) {
        return false;
      }

      return true;
    }

    if (training !== "all" && row.training_id !== training) {
      return false;
    }

    return true;
  });
}

export function formatEducationDate(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  const start = formatIsoDate(startDate);
  const end = formatIsoDate(endDate);
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start || end || "";
}

function formatIsoDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1] ?? value.trim();
}

export function formatTitleDepartment(
  position: string | null | undefined,
  department: string | null | undefined
): string {
  return [position, department]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" / ");
}

export function toEducationStatusExcelRows(
  rows: EducationStatusAttendeeRow[]
): EducationStatusExcelRow[] {
  return rows.map((row) => ({
    교육일자: formatEducationDate(row.training_start_date, row.training_end_date),
    교육월: formatTrainingYearMonth(row.training_year, row.training_month),
    교육과정: row.training_name,
    파트너사: row.is_non_partner ? `${row.partner_name} (비파트너)` : row.partner_name,
    참석자명: row.attendee_name,
    "직함/부서": formatTitleDepartment(row.attendee_position, row.attendee_department),
    연락처: row.attendee_phone?.trim() ?? "",
    이메일: row.attendee_email?.trim() ?? "",
    참석상태: formatAttendanceStatus(row.attended, row.attendance_status),
    수료여부: row.completion_status?.trim() ?? "",
    비고: row.note?.trim() ?? ""
  }));
}

export function educationStatusExcelAoA(rows: EducationStatusExcelRow[]): string[][] {
  const headers = [...EDUCATION_STATUS_EXPORT_HEADERS];
  return [headers, ...rows.map((row) => headers.map((header) => row[header]))];
}

export function educationStatusFilename(
  month: string | undefined,
  now: Date = new Date()
): string {
  const parsed = month && month !== "all" ? parseTrainingGroupKey(month) : null;
  if (parsed) {
    return `education_status_${parsed.year}_${String(parsed.month).padStart(2, "0")}.xlsx`;
  }
  return `education_status_all_${seoulStamp(now)}.xlsx`;
}

export function seoulStamp(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}${month}${day}`;
}
