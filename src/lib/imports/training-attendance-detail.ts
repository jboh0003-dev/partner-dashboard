import type { ParsedTrainingAttendanceRow } from "@/lib/excel/parse-training-attendance-detail";
import { normalizeCompanyName } from "@/lib/partner-match";

export type TrainingAttendancePartnerRow = {
  id: string;
  company_name: string;
};

export type TrainingMasterRow = {
  id: string;
  training_name: string;
  training_type: string | null;
  training_level: string | null;
  product: string | null;
  product_name: string | null;
  session_name: string | null;
  start_date: string | null;
  training_year: number | null;
  training_month: number | null;
};

export type ExistingTrainingAttendanceRow = {
  id: string;
  partner_id: string;
  training_id: string;
  attendee_name: string | null;
};

export type TrainingAttendanceDetailAction = "create" | "update" | "skip" | "review";

export type TrainingAttendanceDetailItem = {
  row_number: number;
  company_name: string;
  attendee_name: string;
  training_name: string;
  training_key: string;
  start_date: string;
  training_year: number | null;
  training_month: number | null;
  action: TrainingAttendanceDetailAction;
  reason: string;
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  matched_training_id: string | null;
  matched_training_name: string | null;
  matched_attendance_id: string | null;
  new_training: boolean;
};

export type TrainingAttendanceDetailSummary = {
  total: number;
  new_trainings: number;
  new_attendees: number;
  updates: number;
  review: number;
  skipped: number;
};

export function analyzeTrainingAttendanceRows(
  rows: ParsedTrainingAttendanceRow[],
  partners: TrainingAttendancePartnerRow[],
  trainings: TrainingMasterRow[],
  attendances: ExistingTrainingAttendanceRow[]
): {
  items: TrainingAttendanceDetailItem[];
  summary: TrainingAttendanceDetailSummary;
} {
  const partnersByName = new Map<string, TrainingAttendancePartnerRow[]>();
  const trainingsByKey = new Map<string, TrainingMasterRow[]>();
  const attendanceByKey = new Map<string, ExistingTrainingAttendanceRow>();
  const plannedNewTrainingKeys = new Set<string>();

  for (const partner of partners) {
    const key = normalizeCompanyName(partner.company_name);
    if (!key) continue;
    const list = partnersByName.get(key) ?? [];
    list.push(partner);
    partnersByName.set(key, list);
  }

  for (const training of trainings) {
    const key = getTrainingKey(
      training.training_name,
      training.training_year,
      training.training_month,
      training.start_date
    );
    const list = trainingsByKey.get(key) ?? [];
    list.push(training);
    trainingsByKey.set(key, list);
  }

  for (const attendance of attendances) {
    const key = `${attendance.partner_id}|${attendance.training_id}|${normalizeName(attendance.attendee_name)}`;
    attendanceByKey.set(key, attendance);
  }

  const items = rows.map((row) =>
    analyzeRow(row, partnersByName, trainingsByKey, attendanceByKey, plannedNewTrainingKeys)
  );

  const summary = items.reduce<TrainingAttendanceDetailSummary>(
    (acc, item) => {
      acc.total += 1;
      if (item.action === "create" && item.new_training) acc.new_trainings += 1;
      if (item.action === "create" && !item.new_training) acc.new_attendees += 1;
      if (item.action === "update") acc.updates += 1;
      if (item.action === "review") acc.review += 1;
      if (item.action === "skip") acc.skipped += 1;
      return acc;
    },
    { total: 0, new_trainings: 0, new_attendees: 0, updates: 0, review: 0, skipped: 0 }
  );

  return { items, summary };
}

function analyzeRow(
  row: ParsedTrainingAttendanceRow,
  partnersByName: Map<string, TrainingAttendancePartnerRow[]>,
  trainingsByKey: Map<string, TrainingMasterRow[]>,
  attendanceByKey: Map<string, ExistingTrainingAttendanceRow>,
  plannedNewTrainingKeys: Set<string>
): TrainingAttendanceDetailItem {
  const trainingKey = getTrainingKey(
    row.training_name,
    row.training_year,
    row.training_month,
    row.start_date
  );
  const startDate =
    row.start_date ??
    (row.training_year && row.training_month
      ? `${row.training_year}-${String(row.training_month).padStart(2, "0")}-01`
      : "");

  if (row.excluded) {
    return {
      row_number: row.row_number,
      company_name: row.company_name,
      attendee_name: row.attendee_name,
      training_name: row.training_name,
      training_key: trainingKey,
      start_date: startDate,
      training_year: row.training_year,
      training_month: row.training_month,
      action: "skip",
      reason: row.excluded_reason ?? "제외",
      matched_partner_id: null,
      matched_partner_name: null,
      matched_training_id: null,
      matched_training_name: null,
      matched_attendance_id: null,
      new_training: false
    };
  }

  if (!row.company_name.trim()) {
    return reviewRow(row, trainingKey, "회사명이 없어 파트너 매칭을 할 수 없습니다.");
  }
  if (!row.attendee_name.trim()) {
    return reviewRow(row, trainingKey, "참석자명이 없습니다.");
  }
  if (!row.training_name.trim()) {
    return reviewRow(row, trainingKey, "교육명이 없습니다.");
  }
  if (!row.training_year || !row.training_month) {
    return reviewRow(row, trainingKey, "교육 연월을 확인할 수 없습니다.");
  }

  const partnerMatches =
    partnersByName.get(normalizeCompanyName(row.company_name) ?? "") ?? [];
  if (partnerMatches.length === 0) return reviewRow(row, trainingKey, "매칭되는 파트너가 없습니다.");
  if (partnerMatches.length > 1) return reviewRow(row, trainingKey, "회사명 원문이 여러 파트너와 일치합니다.");

  const matchedPartner = partnerMatches[0];
  const trainingMatches = trainingsByKey.get(trainingKey) ?? [];

  if (trainingMatches.length > 1) {
    return reviewRow(row, trainingKey, "동일한 교육명/교육연월 조합이 여러 건입니다.", matchedPartner);
  }

  if (trainingMatches.length === 0) {
    const isFirstNewTraining = !plannedNewTrainingKeys.has(trainingKey);
    plannedNewTrainingKeys.add(trainingKey);
    return {
      row_number: row.row_number,
      company_name: row.company_name,
      attendee_name: row.attendee_name,
      training_name: row.training_name,
      training_key: trainingKey,
      start_date: startDate,
      training_year: row.training_year,
      training_month: row.training_month,
      action: "create",
      reason: isFirstNewTraining ? "신규 교육 생성" : "신규 참석자 생성",
      matched_partner_id: matchedPartner.id,
      matched_partner_name: matchedPartner.company_name,
      matched_training_id: null,
      matched_training_name: row.training_name,
      matched_attendance_id: null,
      new_training: isFirstNewTraining
    };
  }

  const matchedTraining = trainingMatches[0];
  const attendanceKey = `${matchedPartner.id}|${matchedTraining.id}|${normalizeName(row.attendee_name)}`;
  const existingAttendance = attendanceByKey.get(attendanceKey);

  if (existingAttendance) {
    return {
      row_number: row.row_number,
      company_name: row.company_name,
      attendee_name: row.attendee_name,
      training_name: row.training_name,
      training_key: trainingKey,
      start_date: startDate,
      training_year: row.training_year,
      training_month: row.training_month,
      action: "update",
      reason: "기존 참석자 이력 업데이트",
      matched_partner_id: matchedPartner.id,
      matched_partner_name: matchedPartner.company_name,
      matched_training_id: matchedTraining.id,
      matched_training_name: matchedTraining.training_name,
      matched_attendance_id: existingAttendance.id,
      new_training: false
    };
  }

  return {
    row_number: row.row_number,
    company_name: row.company_name,
    attendee_name: row.attendee_name,
    training_name: row.training_name,
    training_key: trainingKey,
    start_date: startDate,
    training_year: row.training_year,
    training_month: row.training_month,
    action: "create",
    reason: "신규 참석자 생성",
    matched_partner_id: matchedPartner.id,
    matched_partner_name: matchedPartner.company_name,
    matched_training_id: matchedTraining.id,
    matched_training_name: matchedTraining.training_name,
    matched_attendance_id: null,
    new_training: false
  };
}

function reviewRow(
  row: ParsedTrainingAttendanceRow,
  trainingKey: string,
  reason: string,
  partner?: TrainingAttendancePartnerRow
): TrainingAttendanceDetailItem {
  const startDate =
    row.start_date ??
    (row.training_year && row.training_month
      ? `${row.training_year}-${String(row.training_month).padStart(2, "0")}-01`
      : "");

  return {
    row_number: row.row_number,
    company_name: row.company_name,
    attendee_name: row.attendee_name,
    training_name: row.training_name,
    training_key: trainingKey,
    start_date: startDate,
    training_year: row.training_year,
    training_month: row.training_month,
    action: "review",
    reason,
    matched_partner_id: partner?.id ?? null,
    matched_partner_name: partner?.company_name ?? null,
    matched_training_id: null,
    matched_training_name: null,
    matched_attendance_id: null,
    new_training: false
  };
}

function getTrainingKey(
  trainingName: string,
  trainingYear: number | null,
  trainingMonth: number | null,
  startDate?: string | null
): string {
  if (trainingYear && trainingMonth) {
    return `${normalizeName(trainingName)}|${trainingYear}|${trainingMonth}`;
  }
  return `${normalizeName(trainingName)}|${startDate ?? ""}`;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}
