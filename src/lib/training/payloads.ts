import { normalizeTrainingType } from "@/lib/training/constants";
import type { ParsedTrainingAttendanceRow } from "@/lib/excel/parse-training-attendance-detail";

export function buildTrainingInsertPayload(
  row: ParsedTrainingAttendanceRow
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    training_name: row.training_name,
    session_name: row.training_name,
    training_type: normalizeTrainingType(row.training_type),
    training_year: row.training_year,
    training_month: row.training_month,
    start_date:
      row.start_date ??
      (row.training_year && row.training_month
        ? `${row.training_year}-${String(row.training_month).padStart(2, "0")}-01`
        : null),
    source_file: row.source_file
  };

  if (row.training_level) payload.training_level = row.training_level;
  if (row.product) {
    payload.product = row.product;
    payload.product_name = row.product;
  }

  return payload;
}

export function buildTrainingFillEmptyPatch(
  row: ParsedTrainingAttendanceRow
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};

  if (row.training_level) patch.training_level = row.training_level;
  if (row.product) {
    patch.product = row.product;
    patch.product_name = row.product;
  }
  if (row.training_type) patch.training_type = normalizeTrainingType(row.training_type);

  return Object.keys(patch).length > 0 ? patch : null;
}

export function buildAttendancePayload(
  row: ParsedTrainingAttendanceRow,
  partnerId: string,
  trainingId: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    partner_id: partnerId,
    training_id: trainingId,
    attendee_name: row.attendee_name,
    attended: row.attended,
    attendance_status: row.attendance_status ?? "참석",
    source_file: row.source_file
  };

  if (row.attendee_department) payload.attendee_department = row.attendee_department;
  if (row.attendee_position) payload.attendee_position = row.attendee_position;
  if (row.attendee_phone) payload.attendee_phone = row.attendee_phone;
  if (row.attendee_email) payload.attendee_email = row.attendee_email;
  if (row.raw_value) payload.raw_value = row.raw_value;
  if (row.completion_status) payload.completion_status = row.completion_status;
  if (row.score != null) payload.score = row.score;
  if (row.evaluation_result) payload.evaluation_result = row.evaluation_result;

  const note = row.note ?? row.attendee_memo;
  if (note) {
    payload.note = note;
    payload.evaluation_memo = note;
  }

  return payload;
}
