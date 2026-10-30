import type { EducationStatusAttendeeRow } from "@/lib/trainings/education-status-export";
import { normalizeAttendeePersonKey } from "@/lib/trainings/attendance-stats";

export const TRAINING_KPI_YEAR = 2026;

export type AnnualAttendeePerson = {
  key: string;
  partnerId: string;
  partnerName: string;
  name: string;
  position: string | null;
  department: string | null;
  attendanceCount: number;
  trainingNames: string[];
  trainingMonths: number[];
};

export type AnnualAttendingPartner = {
  id: string;
  name: string;
  uniquePeople: number;
  attendanceCount: number;
};

export type AnnualTrainingKpis = {
  year: number;
  uniqueAttendees: number;
  totalAttendances: number;
  partnerCount: number;
  people: AnnualAttendeePerson[];
  partners: AnnualAttendingPartner[];
  attendanceRows: EducationStatusAttendeeRow[];
};

/**
 * One real person is counted once per registered partner + normalized name.
 * Course-by-course participation counts each verified attendance record.
 *
 * Input must already be scoped to active, non-sample partners and valid
 * attended records, with duplicate imports of the same course removed.
 */
export function buildAnnualTrainingKpis(
  rows: EducationStatusAttendeeRow[],
  year = TRAINING_KPI_YEAR
): AnnualTrainingKpis {
  const attendanceRows = rows.filter((row) =>
    row.training_year === year &&
    Boolean(row.partner_id) &&
    Boolean(normalizeAttendeePersonKey(row.attendee_name)) &&
    row.attended === true
  );
  type PersonDraft = AnnualAttendeePerson & {
    courses: Set<string>;
    months: Set<number>;
  };
  const peopleByKey = new Map<string, PersonDraft>();
  const partnersById = new Map<string, AnnualAttendingPartner>();

  for (const row of attendanceRows) {
    const partnerId = row.partner_id!;
    const personKey = partnerId + "|" + normalizeAttendeePersonKey(row.attendee_name);
    let person = peopleByKey.get(personKey);
    if (!person) {
      person = {
        key: personKey,
        partnerId,
        partnerName: row.partner_name,
        name: row.attendee_name,
        position: row.attendee_position,
        department: row.attendee_department,
        attendanceCount: 0,
        trainingNames: [],
        trainingMonths: [],
        courses: new Set<string>(),
        months: new Set<number>()
      };
      peopleByKey.set(personKey, person);
    }
    person.attendanceCount += 1;
    if (!person.position && row.attendee_position) person.position = row.attendee_position;
    if (!person.department && row.attendee_department) person.department = row.attendee_department;
    if (row.training_name && row.training_name !== "-") person.courses.add(row.training_name);
    if (row.training_month && row.training_month >= 1 && row.training_month <= 12) {
      person.months.add(row.training_month);
    }

    let partner = partnersById.get(partnerId);
    if (!partner) {
      partner = { id: partnerId, name: row.partner_name, uniquePeople: 0, attendanceCount: 0 };
      partnersById.set(partnerId, partner);
    }
    partner.attendanceCount += 1;
  }

  const people = [...peopleByKey.values()].map(({ courses, months, ...person }) => ({
    ...person,
    trainingNames: [...courses].sort((a, b) => a.localeCompare(b, "ko-KR")),
    trainingMonths: [...months].sort((a, b) => a - b)
  })).sort((a, b) =>
    a.partnerName.localeCompare(b.partnerName, "ko-KR") ||
    a.name.localeCompare(b.name, "ko-KR")
  );

  for (const person of people) {
    const partner = partnersById.get(person.partnerId);
    if (partner) partner.uniquePeople += 1;
  }

  const partners = [...partnersById.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));

  return {
    year,
    uniqueAttendees: people.length,
    totalAttendances: attendanceRows.length,
    partnerCount: partners.length,
    people,
    partners,
    attendanceRows
  };
}
