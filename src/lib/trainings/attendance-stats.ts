export function normalizeAttendeePersonKey(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

export function isCountedTrainingAttendee(row: {
  attended?: boolean | null;
  attendance_status?: string | null;
}): boolean {
  if (row.attended === false) return false;
  const status = (row.attendance_status ?? "").trim();
  if (status && /불참|결석|미참석/.test(status) && !/참석인정|출석/.test(status)) {
    return false;
  }
  return true;
}

export function trainingAttendeeUniqueKey(row: {
  training_id: string;
  attendee_name: string | null;
  partner_id?: string | null;
  company_name_raw?: string | null;
  partner_name?: string | null;
}): string {
  const name = normalizeAttendeePersonKey(row.attendee_name);
  const company = normalizeAttendeePersonKey(
    row.company_name_raw || row.partner_name || row.partner_id || ""
  );
  return `${row.training_id}|${name}|${company}`;
}

export function monthlyAttendeeUniqueKey(
  year: number,
  month: number,
  isTech: boolean,
  row: {
    attendee_name: string | null;
    partner_id?: string | null;
    company_name_raw?: string | null;
    partner_name?: string | null;
  }
): string {
  const name = normalizeAttendeePersonKey(row.attendee_name);
  const company = normalizeAttendeePersonKey(
    row.company_name_raw || row.partner_name || row.partner_id || ""
  );
  return `${year}|${month}|${isTech ? "tech" : "regular"}|${name}|${company}`;
}
