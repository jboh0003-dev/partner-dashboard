import type { Training } from "@/types/training";
import type { EducationStatusAttendeeRow } from "@/lib/trainings/education-status-export";
import {
  isCountedTrainingAttendee,
  monthlyAttendeeUniqueKey,
  normalizeAttendeePersonKey
} from "@/lib/trainings/attendance-stats";
import { extractCourseTags } from "@/lib/trainings/course-tags";
import {
  formatTrainingGroupLabel,
  isTechPartnerTraining,
  trainingGroupKey
} from "@/lib/training-display";

export type MonthlyEducationSummary = {
  key: string;
  year: number;
  month: number;
  label: string;
  isTech: boolean;
  attendanceCount: number;
  partnerCount: number;
  courseSummary: string;
};

export type YearlyEducationSummary = {
  year: number;
  monthCount: number;
  uniqueAttendees: number;
  participationCount: number;
  totalAttendances: number;
  partnerCount: number;
};

export function filterOfficialTrainingAttendees(
  rows: EducationStatusAttendeeRow[],
  realPartnerIds: Set<string>,
  activeTrainingIds: Set<string>
): EducationStatusAttendeeRow[] {
  return rows.filter((row) =>
    Boolean(
      row.partner_id &&
      realPartnerIds.has(row.partner_id) &&
      activeTrainingIds.has(row.training_id) &&
      row.attendee_name &&
      row.attendee_name !== "-" &&
      row.training_year &&
      row.training_month &&
      isCountedTrainingAttendee(row)
    )
  );
}

function courseKey(trainingName: string, product: string | null): string {
  const tags = extractCourseTags(trainingName + " " + (product ?? ""))
    .filter((tag) => tag !== "기타")
    .sort();
  if (tags.length) return tags.join("+");
  return trainingName.toUpperCase()
    .replace(/[\[\]\s]/g, "")
    .replace(/BASIC(?:V?\d+(?:\.\d+)*)?/g, "")
    .replace(/V\d+(?:\.\d+)*/g, "")
    .replace(/오케스트로/g, "")
    .replace(/최신/g, "")
    .replace(/교육$/g, "");
}

/**
 * Remove duplicate imports of a course (e.g. "CONTRABASS" and
 * "[CONTRABASS Basic]") without merging genuinely different dates or courses.
 * Original attendance records are never modified or removed.
 */
export function dedupeTrainingAttendanceRows(
  rows: EducationStatusAttendeeRow[]
): EducationStatusAttendeeRow[] {
  const byKey = new Map<string, EducationStatusAttendeeRow>();
  for (const row of rows) {
    const key = [
      row.training_year ?? "",
      row.training_month ?? "",
      isTechPartnerTraining(row) ? "tech" : "regular",
      row.training_start_date || "",
      courseKey(row.training_name, row.product),
      row.partner_id || "",
      normalizeAttendeePersonKey(row.attendee_name)
    ].join("|");
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, row);
      continue;
    }
    const quality = (candidate: EducationStatusAttendeeRow) =>
      Number(!candidate.training_name.includes("[")) +
      Number(candidate.score != null) * 3 +
      Number(Boolean(candidate.completion_status)) * 2 +
      Number(Boolean(candidate.note)) +
      Number(Boolean(candidate.attendee_email));
    if (quality(row) > quality(current)) byKey.set(key, row);
  }
  return Array.from(byKey.values());
}

function courseLabels(training: Training): string[] {
  const tags = extractCourseTags(training.training_name + " " + (training.product ?? ""))
    .filter((tag) => tag !== "기타");
  if (tags.length) return tags;
  if (isTechPartnerTraining(training)) return ["기술파트너 교육"];
  if (/클라우드/.test(training.training_name)) return ["클라우드 트렌드"];
  if (/오픈스택/.test(training.training_name)) return ["오픈스택"];
  if (/솔루션/.test(training.training_name)) return ["솔루션"];
  return ["정기교육"];
}

export function buildEducationOverview(
  trainings: Training[],
  attendeeRows: EducationStatusAttendeeRow[]
): { monthly: MonthlyEducationSummary[]; yearly: YearlyEducationSummary[] } {
  type Bucket = {
    year: number;
    month: number;
    isTech: boolean;
    people: Set<string>;
    partners: Set<string>;
    courses: Set<string>;
  };
  const byGroup = new Map<string, Bucket>();
  for (const training of trainings) {
    const year = training.training_year;
    const month = training.training_month;
    if (!year || !month || month < 1 || month > 12) continue;
    const isTech = isTechPartnerTraining(training);
    const key = trainingGroupKey(year, month, isTech);
    let bucket = byGroup.get(key);
    if (!bucket) {
      bucket = {
        year,
        month,
        isTech,
        people: new Set(),
        partners: new Set(),
        courses: new Set()
      };
      byGroup.set(key, bucket);
    }
    for (const label of courseLabels(training)) bucket.courses.add(label);
  }

  const byYear = new Map<number, {
    months: Set<number>;
    people: Set<string>;
    partners: Set<string>;
  }>();
  for (const row of attendeeRows) {
    const year = row.training_year;
    const month = row.training_month;
    if (!year || !month || !row.partner_id) continue;
    const isTech = isTechPartnerTraining(row);
    const bucket = byGroup.get(trainingGroupKey(year, month, isTech));
    if (!bucket) continue;
    bucket.people.add(monthlyAttendeeUniqueKey(year, month, isTech, row));
    bucket.partners.add(row.partner_id);
    if (!byYear.has(year)) {
      byYear.set(year, { months: new Set(), people: new Set(), partners: new Set() });
    }
    const annual = byYear.get(year)!;
    annual.months.add(month);
    annual.partners.add(row.partner_id);
    annual.people.add(row.partner_id + "|" + normalizeAttendeePersonKey(row.attendee_name));
  }

  const monthly = Array.from(byGroup, ([key, bucket]) => ({
    key,
    year: bucket.year,
    month: bucket.month,
    label: formatTrainingGroupLabel(bucket.year, bucket.month, bucket.isTech),
    isTech: bucket.isTech,
    attendanceCount: bucket.people.size,
    partnerCount: bucket.partners.size,
    courseSummary: Array.from(bucket.courses).join(" · ")
  })).sort((a, b) =>
    b.year - a.year || b.month - a.month || Number(a.isTech) - Number(b.isTech)
  );

  const years = new Set(trainings.map((training) => training.training_year).filter(
    (year): year is number => Boolean(year)
  ));
  const yearly = Array.from(years).sort((a, b) => b - a).map((year) => {
    const entry = byYear.get(year);
    return {
      year,
      monthCount: entry?.months.size ?? 0,
      uniqueAttendees: entry?.people.size ?? 0,
      participationCount: monthly
        .filter((row) => row.year === year)
        .reduce((total, row) => total + row.attendanceCount, 0),
      totalAttendances: attendeeRows.filter((row) => row.training_year === year).length,
      partnerCount: entry?.partners.size ?? 0
    };
  });
  return { monthly, yearly };
}
