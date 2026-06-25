import { CONTACT_ROLE_LABEL, PARTNER_GRADE_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  formatTrainingYearMonth,
  parseYearMonthKey,
  yearMonthKey
} from "@/lib/training-display";
import {
  COURSE_TAGS,
  extractCourseTags,
  formatCourseTags,
  getNotAttendedCourseTags,
  normalizeTrainingNameKey,
  type CourseTag
} from "@/lib/trainings/course-tags";
import type { Partner, PartnerContact } from "@/types/partner";
import type { Training } from "@/types/training";

export type RecruitmentAudience =
  | "all"
  | "no_history"
  | "month_absent"
  | "prior_history_month_absent"
  | "course_tags"
  | "new_no_history";

export type RecruitmentContactRole =
  | "all"
  | "contract"
  | "primary"
  | "sales"
  | "engineer";

export type RecruitmentFilters = {
  audience?: RecruitmentAudience;
  months?: string[];
  attended_tags?: CourseTag[];
  not_attended_tags?: CourseTag[];
  new_partner_since?: string;
  grade?: string;
  contract_from?: string;
  contract_to?: string;
  contact_role?: RecruitmentContactRole;
  q?: string;
};

export type RecruitmentRow = {
  id: string;
  partnerId: string;
  companyName: string;
  grade: string | null;
  gradeLabel: string;
  contractStartDate: string | null;
  contractStartDateLabel: string;
  latestTrainingMonth: string | null;
  attendanceCount: number;
  attendedCourseTags: string;
  notAttendedCourseTags: string;
  contactName: string | null;
  contactPosition: string | null;
  contactRole: string | null;
  contactRoleLabel: string;
  contactPhone: string | null;
  contactEmail: string | null;
};

export type RecruitmentSourceData = {
  partners: Partner[];
  contacts: PartnerContact[];
  attendances: Array<{
    partner_id: string;
    training_id: string;
    attended: boolean;
  }>;
  trainings: Training[];
};

type PartnerAttendanceProfile = {
  allRecordCount: number;
  attendedRecordCount: number;
  attendedMonths: Set<string>;
  allMonths: Set<string>;
  courseTags: Set<CourseTag>;
  latestYear: number;
  latestMonth: number;
};

export function buildRecruitmentRows(
  source: RecruitmentSourceData,
  filters: RecruitmentFilters
): RecruitmentRow[] {
  const contactsByPartner = groupContactsByPartner(source.contacts);
  const trainingById = new Map(source.trainings.map((training) => [training.id, training]));
  const profiles = buildPartnerProfiles(source.attendances, trainingById);

  const rows: RecruitmentRow[] = [];

  for (const partner of source.partners) {
    if (partner.status !== "active") continue;
    if (!passesGradeFilter(partner, filters.grade)) continue;
    if (!passesContractDateFilter(partner, filters)) continue;

    const profile = profiles.get(partner.id) ?? emptyProfile();
    if (!passesAudienceFilter(partner, profile, filters)) continue;
    if (!passesCourseTagFilter(profile, filters)) continue;

    const partnerContacts = contactsByPartner.get(partner.id) ?? [];
    const contact = resolveRecruitmentContact(
      partnerContacts,
      filters.contact_role ?? "all"
    );

    if (!contact && (filters.contact_role ?? "all") !== "all") continue;

    const row: RecruitmentRow = {
      id: contact ? `${partner.id}:${contact.id}` : partner.id,
      partnerId: partner.id,
      companyName: partner.company_name,
      grade: partner.grade,
      gradeLabel:
        PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? partner.grade ?? "-",
      contractStartDate: partner.contract_start_date,
      contractStartDateLabel: partner.contract_start_date
        ? formatDate(partner.contract_start_date)
        : "-",
      latestTrainingMonth:
        profile.latestYear && profile.latestMonth
          ? formatTrainingYearMonth(profile.latestYear, profile.latestMonth)
          : null,
      attendanceCount: profile.attendedRecordCount,
      attendedCourseTags: formatCourseTags(profile.courseTags),
      notAttendedCourseTags: formatCourseTags(
        getNotAttendedCourseTags(profile.courseTags)
      ),
      contactName: contact?.name ?? null,
      contactPosition: contact?.position ?? null,
      contactRole: contact?.role_type ?? null,
      contactRoleLabel: contact?.role_type
        ? (CONTACT_ROLE_LABEL[contact.role_type] ?? contact.role_type)
        : "-",
      contactPhone: contact?.phone ?? null,
      contactEmail: contact?.email ?? null
    };

    if (!passesSearchFilter(row, filters.q)) continue;
    rows.push(row);
  }

  return rows.sort((a, b) =>
    a.companyName.localeCompare(b.companyName, "ko-KR", {
      numeric: true,
      sensitivity: "base"
    })
  );
}

export function recruitmentRowsToCsv(rows: RecruitmentRow[]) {
  return rows.map((row) => ({
    회사명: row.companyName,
    등급: row.gradeLabel,
    계약일자: row.contractStartDateLabel,
    최근교육월: row.latestTrainingMonth ?? "-",
    "교육 참석 이력 수": row.attendanceCount,
    "수강 교육 태그": row.attendedCourseTags,
    "미수강 교육 태그": row.notAttendedCourseTags,
    담당자명: row.contactName ?? "",
    직급: row.contactPosition ?? "",
    역할: row.contactRoleLabel,
    연락처: row.contactPhone ?? "",
    이메일: row.contactEmail ?? ""
  }));
}

export function buildMonthOptions(
  trainings: Training[]
): Array<{ value: string; label: string }> {
  const seen = new Map<string, string>();

  for (const training of trainings) {
    if (!training.training_year || !training.training_month) continue;
    const value = yearMonthKey(training.training_year, training.training_month);
    seen.set(
      value,
      formatTrainingYearMonth(training.training_year, training.training_month)
    );
  }

  return Array.from(seen.entries())
    .sort(([a], [b]) => b.localeCompare(a, "ko-KR", { numeric: true }))
    .map(([value, label]) => ({ value, label }));
}

export function parseMonthsParam(
  value: string | string[] | undefined
): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : value.split(",");
  return raw.map((item) => item.trim()).filter(Boolean);
}

export function parseRecruitmentAudience(
  value: string | undefined
): RecruitmentAudience {
  const allowed: RecruitmentAudience[] = [
    "all",
    "no_history",
    "month_absent",
    "prior_history_month_absent",
    "course_tags",
    "new_no_history"
  ];
  if (value && allowed.includes(value as RecruitmentAudience)) {
    return value as RecruitmentAudience;
  }
  return "no_history";
}

export function parseRecruitmentContactRole(
  value: string | undefined
): RecruitmentContactRole {
  if (
    value === "contract" ||
    value === "primary" ||
    value === "sales" ||
    value === "engineer"
  ) {
    return value;
  }
  return "all";
}

export function resolveRecruitmentContact(
  contacts: PartnerContact[],
  roleFilter: RecruitmentContactRole
): PartnerContact | null {
  if (contacts.length === 0) return null;

  switch (roleFilter) {
    case "contract":
      return contacts.find((contact) => contact.is_contract_contact) ?? null;
    case "primary":
      return contacts.find((contact) => contact.is_primary) ?? null;
    case "sales":
      return contacts.find((contact) => contact.role_type === "sales") ?? null;
    case "engineer":
      return contacts.find((contact) => contact.role_type === "engineer") ?? null;
    case "all":
    default:
      return (
        contacts.find((contact) => contact.is_contract_contact) ??
        contacts.find((contact) => contact.is_primary) ??
        contacts.find((contact) => contact.role_type === "sales") ??
        contacts.find((contact) => contact.role_type === "engineer") ??
        contacts[0] ??
        null
      );
  }
}

function buildPartnerProfiles(
  attendances: RecruitmentSourceData["attendances"],
  trainingById: Map<string, Training>
): Map<string, PartnerAttendanceProfile> {
  const profiles = new Map<string, PartnerAttendanceProfile>();
  const attendedNamesByPartner = new Map<string, Set<string>>();

  for (const row of attendances) {
    const profile = getOrCreateProfile(profiles, row.partner_id);
    profile.allRecordCount += 1;

    const training = trainingById.get(row.training_id);
    if (training?.training_year && training.training_month) {
      const monthKey = yearMonthKey(training.training_year, training.training_month);
      profile.allMonths.add(monthKey);
    }

    if (!row.attended) continue;

    if (training?.training_year && training.training_month) {
      const monthKey = yearMonthKey(training.training_year, training.training_month);
      profile.attendedMonths.add(monthKey);
      if (
        training.training_year > profile.latestYear ||
        (training.training_year === profile.latestYear &&
          training.training_month > profile.latestMonth)
      ) {
        profile.latestYear = training.training_year;
        profile.latestMonth = training.training_month;
      }
    }

    if (training?.training_name) {
      const nameKey = normalizeTrainingNameKey(training.training_name);
      const names = attendedNamesByPartner.get(row.partner_id) ?? new Set<string>();
      if (!names.has(nameKey)) {
        names.add(nameKey);
        attendedNamesByPartner.set(row.partner_id, names);
        profile.attendedRecordCount = names.size;
        for (const tag of extractCourseTags(training.training_name)) {
          profile.courseTags.add(tag);
        }
      }
    }
  }

  return profiles;
}

function emptyProfile(): PartnerAttendanceProfile {
  return {
    allRecordCount: 0,
    attendedRecordCount: 0,
    attendedMonths: new Set(),
    allMonths: new Set(),
    courseTags: new Set(),
    latestYear: 0,
    latestMonth: 0
  };
}

function getOrCreateProfile(
  profiles: Map<string, PartnerAttendanceProfile>,
  partnerId: string
): PartnerAttendanceProfile {
  if (!profiles.has(partnerId)) {
    profiles.set(partnerId, emptyProfile());
  }
  return profiles.get(partnerId)!;
}

function groupContactsByPartner(contacts: PartnerContact[]) {
  const map = new Map<string, PartnerContact[]>();
  for (const contact of contacts) {
    const list = map.get(contact.partner_id) ?? [];
    list.push(contact);
    map.set(contact.partner_id, list);
  }
  return map;
}

function passesGradeFilter(partner: Partner, grade: string | undefined): boolean {
  if (!grade || grade === "all") return true;
  return (partner.grade ?? "none") === grade;
}

function passesContractDateFilter(partner: Partner, filters: RecruitmentFilters): boolean {
  const date = partner.contract_start_date;
  if (!filters.contract_from && !filters.contract_to) return true;
  if (!date) return false;
  if (filters.contract_from && date < filters.contract_from) return false;
  if (filters.contract_to && date > filters.contract_to) return false;
  return true;
}

function passesAudienceFilter(
  partner: Partner,
  profile: PartnerAttendanceProfile,
  filters: RecruitmentFilters
): boolean {
  const audience = filters.audience ?? "no_history";
  const months = filters.months ?? [];

  switch (audience) {
    case "all":
      return true;
    case "no_history":
      return profile.allRecordCount === 0;
    case "month_absent":
      return (
        months.length > 0 &&
        months.every((month) => !profile.allMonths.has(month))
      );
    case "prior_history_month_absent": {
      if (months.length === 0) return false;
      const threshold = minYearMonth(months);
      if (threshold === null) return false;
      return (
        hasAttendanceBefore(profile, threshold) &&
        months.every((month) => !profile.allMonths.has(month))
      );
    }
    case "course_tags":
      return true;
    case "new_no_history":
      return (
        isNewPartner(partner, filters.new_partner_since) &&
        profile.allRecordCount === 0
      );
    default:
      return profile.allRecordCount === 0;
  }
}

function passesCourseTagFilter(
  profile: PartnerAttendanceProfile,
  filters: RecruitmentFilters
): boolean {
  const attendedTags = filters.attended_tags ?? [];
  const notAttendedTags = filters.not_attended_tags ?? [];

  if (filters.audience === "course_tags") {
    if (attendedTags.length === 0 && notAttendedTags.length === 0) return false;
  } else if (attendedTags.length === 0 && notAttendedTags.length === 0) {
    return true;
  }

  for (const tag of attendedTags) {
    if (!profile.courseTags.has(tag)) return false;
  }

  for (const tag of notAttendedTags) {
    if (profile.courseTags.has(tag)) return false;
  }

  return true;
}

function isNewPartner(partner: Partner, since: string | undefined): boolean {
  const date = partner.contract_start_date;
  if (!date || !since) return false;
  return date >= since;
}

function minYearMonth(months: string[]): number | null {
  let best: number | null = null;

  for (const month of months) {
    const parsed = parseYearMonthKey(month);
    if (!parsed) continue;
    const value = parsed.year * 100 + parsed.month;
    if (best === null || value < best) best = value;
  }

  return best;
}

function hasAttendanceBefore(
  profile: PartnerAttendanceProfile,
  threshold: number
): boolean {
  for (const month of profile.allMonths) {
    const parsed = parseYearMonthKey(month);
    if (!parsed) continue;
    const value = parsed.year * 100 + parsed.month;
    if (value < threshold) return true;
  }
  return false;
}

function passesSearchFilter(row: RecruitmentRow, query: string | undefined): boolean {
  const q = query?.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    row.companyName,
    row.contactName,
    row.contactPhone,
    row.contactEmail
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export { COURSE_TAGS };
