import type { ParsedTechPartnerExamRow } from "@/lib/excel/parse-tech-partner-exam";
import { examRowHasScore } from "@/lib/excel/parse-tech-partner-exam";
import type { ParsedTechPartnerRosterRow } from "@/lib/excel/parse-tech-partner-roster";
import { companyNamesMatchWithVariants } from "@/lib/documents/partner-aliases";
import { normalizeCompanyName } from "@/lib/partner-match";
import {
  TECH_PARTNER_TRAINING_SESSION,
  type TechPartnerEducationStatus,
  type TechPartnerExamStatus
} from "@/lib/tech-partner-training/constants";
import { enrichBeomilReviewParticipant } from "@/lib/imports/tech-partner-beomil";
import { normalizePhoneDigits, phonesMatch } from "@/lib/tech-partner-training/phone";

export type TechPartnerPartnerRow = {
  id: string;
  company_name: string;
};

export type TechPartnerContactRow = {
  id: string;
  partner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  role_type: string | null;
};

export type TechPartnerMatchAction = "ready" | "review" | "exclude";

export type TechPartnerParticipantRecord = {
  key: string;
  company_name: string;
  participant_name: string;
  title: string | null;
  group_name: string | null;
  phone: string | null;
  email: string | null;
  in_roster: boolean;
  in_exam: boolean;
  education_status: TechPartnerEducationStatus;
  has_any_attendance_record: boolean;
  no_show: boolean;
  attendance_days: number | null;
  partial_days: number | null;
  absent_days: number | null;
  attendance_rate: number | null;
  daily_attendance: Record<string, string> | null;
  rank: number | null;
  total_score: number | null;
  converted_score: number | null;
  solution_understanding_score: number | null;
  technical_test_score: number | null;
  advanced_basic_score: number | null;
  operation_score: number | null;
  troubleshooting_score: number | null;
  exam_status: TechPartnerExamStatus;
  needs_review: boolean;
  match_action: TechPartnerMatchAction;
  match_status: "matched" | "review" | "unmatched";
  review_reason: string | null;
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  partner_candidates: Array<{ id: string; company_name: string }>;
  matched_contact_id: string | null;
  contact_candidates: Array<{ id: string; name: string; phone: string | null }>;
  roster_source_file: string | null;
  exam_source_file: string | null;
  exam_raw_json: Record<string, unknown> | null;
  attendance_scope: string | null;
  manual_correction_note: string | null;
  correction_applied: boolean;
  review_category: string | null;
};

export type TechPartnerPartnerSummary = {
  partner_id: string | null;
  company_name: string;
  registered_count: number;
  attended_count: number;
  no_show_count: number;
  exam_taken_count: number;
  avg_total_score: number | null;
  avg_converted_score: number | null;
  max_total_score: number | null;
  min_total_score: number | null;
  needs_review: boolean;
  /** @deprecated attended_count 사용 권장 */
  attendee_count: number;
};

export type TechPartnerAnalysisSummary = {
  training_name: string;
  start_date: string;
  end_date: string;
  registered_count: number;
  attended_count: number;
  no_show_count: number;
  exam_taken_count: number;
  normal_match_count: number;
  review_count: number;
  result_only_count: number;
  roster_only_count: number;
  no_exam_count: number;
  partner_count: number;
  analysis_valid: boolean;
  analysis_error: string | null;
  /** @deprecated registered_count 사용 */
  roster_count: number;
  /** @deprecated exam_taken_count 사용 */
  exam_count: number;
  /** @deprecated normal_match_count 사용 */
  matched_count: number;
};

export type TechPartnerAnalysisResult = {
  summary: TechPartnerAnalysisSummary;
  participants: TechPartnerParticipantRecord[];
  partner_summaries: TechPartnerPartnerSummary[];
};

const ANALYSIS_ERROR_MESSAGE =
  "분석 결과가 비정상입니다. 출석부/시험결과 매칭 로직을 확인해 주세요.";

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** 출석부·시험결과 병합 키: 파트너사 + 이름 (전화번호 제외) */
function personMergeKey(company: string, name: string): string {
  return `${normalizeCompanyName(company)}|${normalizeName(name)}`;
}

function participantHasExamScore(participant: TechPartnerParticipantRecord): boolean {
  return participant.total_score != null || participant.converted_score != null;
}

function applyExamFields(
  target: TechPartnerParticipantRecord,
  exam: ParsedTechPartnerExamRow
): void {
  target.in_exam = true;
  target.rank = exam.rank;
  target.total_score = exam.total_score;
  target.converted_score = exam.converted_score;
  target.solution_understanding_score = exam.solution_understanding_score;
  target.technical_test_score = exam.technical_test_score;
  target.advanced_basic_score = exam.advanced_basic_score;
  target.operation_score = exam.operation_score;
  target.troubleshooting_score = exam.troubleshooting_score;
  target.exam_source_file = exam.source_file;
  target.exam_raw_json = exam.raw_json;
  if (!target.phone && exam.phone) target.phone = exam.phone;
  if (examRowHasScore(exam)) {
    target.exam_status = "응시";
  }
}

function createFromRoster(roster: ParsedTechPartnerRosterRow): TechPartnerParticipantRecord {
  return {
    key: personMergeKey(roster.company_name, roster.participant_name),
    company_name: roster.company_name,
    participant_name: roster.participant_name,
    title: roster.title,
    group_name: roster.group_name,
    phone: roster.phone,
    email: roster.email,
    in_roster: true,
    in_exam: false,
    education_status: roster.no_show ? "no_show" : "attended",
    has_any_attendance_record: roster.has_any_attendance_record,
    no_show: roster.no_show,
    attendance_days: roster.attendance_days,
    partial_days: roster.partial_days,
    absent_days: roster.absent_days,
    attendance_rate: roster.attendance_rate,
    daily_attendance: roster.daily_attendance,
    rank: null,
    total_score: null,
    converted_score: null,
    solution_understanding_score: null,
    technical_test_score: null,
    advanced_basic_score: null,
    operation_score: null,
    troubleshooting_score: null,
    exam_status: "미응시",
    needs_review: false,
    match_action: "ready",
    match_status: "matched",
    review_reason: null,
    matched_partner_id: null,
    matched_partner_name: null,
    partner_candidates: [],
    matched_contact_id: null,
    contact_candidates: [],
    roster_source_file: roster.source_file,
    exam_source_file: null,
    exam_raw_json: null,
    attendance_scope: null,
    manual_correction_note: null,
    correction_applied: false,
    review_category: null
  };
}

function createFromExam(exam: ParsedTechPartnerExamRow): TechPartnerParticipantRecord {
  const hasScore = examRowHasScore(exam);
  return {
    key: personMergeKey(exam.company_name, exam.participant_name),
    company_name: exam.company_name,
    participant_name: exam.participant_name,
    title: null,
    group_name: null,
    phone: exam.phone,
    email: null,
    in_roster: false,
    in_exam: hasScore,
    education_status: "result_only",
    has_any_attendance_record: false,
    no_show: false,
    attendance_days: null,
    partial_days: null,
    absent_days: null,
    attendance_rate: null,
    daily_attendance: null,
    rank: exam.rank,
    total_score: exam.total_score,
    converted_score: exam.converted_score,
    solution_understanding_score: exam.solution_understanding_score,
    technical_test_score: exam.technical_test_score,
    advanced_basic_score: exam.advanced_basic_score,
    operation_score: exam.operation_score,
    troubleshooting_score: exam.troubleshooting_score,
    exam_status: hasScore ? "응시" : "결과없음",
    needs_review: true,
    match_action: "review",
    match_status: "review",
    review_reason: "시험결과에는 있으나 출석부에 없습니다.",
    matched_partner_id: null,
    matched_partner_name: null,
    partner_candidates: [],
    matched_contact_id: null,
    contact_candidates: [],
    roster_source_file: null,
    exam_source_file: exam.source_file,
    exam_raw_json: exam.raw_json,
    attendance_scope: null,
    manual_correction_note: null,
    correction_applied: false,
    review_category: null
  };
}

function finalizeEducationAndExamStatus(participant: TechPartnerParticipantRecord): void {
  if (participant.in_roster && participant.in_exam && participantHasExamScore(participant)) {
    participant.education_status = participant.no_show ? "attended" : "attended";
    participant.exam_status = "응시";
    return;
  }

  if (participant.in_roster && !participant.in_exam) {
    if (participant.no_show) {
      participant.education_status = "no_show";
      participant.exam_status = "미응시";
    } else if (participant.has_any_attendance_record) {
      participant.education_status = "attended";
      participant.exam_status = "미응시";
      participant.needs_review = true;
      participant.review_reason =
        participant.review_reason ?? "출석부에는 있으나 시험결과가 없습니다.";
    } else {
      participant.education_status = "no_show";
      participant.exam_status = "미응시";
    }
    return;
  }

  if (!participant.in_roster && participant.in_exam && participantHasExamScore(participant)) {
    participant.education_status = "result_only";
    participant.exam_status = "응시";
    participant.needs_review = true;
    participant.review_reason =
      participant.review_reason ?? "시험결과에는 있으나 출석부에 없습니다.";
  }
}

function matchPartner(
  companyName: string,
  partners: TechPartnerPartnerRow[]
): {
  partner: TechPartnerPartnerRow | null;
  candidates: TechPartnerPartnerRow[];
  reason: string | null;
} {
  const exact = partners.filter(
    (p) => p.company_name.trim().toLowerCase() === companyName.trim().toLowerCase()
  );
  if (exact.length === 1) return { partner: exact[0]!, candidates: exact, reason: null };
  if (exact.length > 1) {
    return { partner: null, candidates: exact, reason: "동일 파트너사명이 여러 건입니다." };
  }

  const variantMatches = partners.filter((p) =>
    companyNamesMatchWithVariants(companyName, p.company_name)
  );
  if (variantMatches.length === 1) {
    return { partner: variantMatches[0]!, candidates: variantMatches, reason: null };
  }
  if (variantMatches.length > 1) {
    return { partner: null, candidates: variantMatches, reason: "유사 파트너사명이 여러 건입니다." };
  }

  const normalized = normalizeCompanyName(companyName);
  const includes = partners.filter((p) => {
    const key = normalizeCompanyName(p.company_name);
    return key && normalized && (key.includes(normalized) || normalized.includes(key));
  });
  if (includes.length === 1) return { partner: includes[0]!, candidates: includes, reason: null };
  if (includes.length > 1) {
    return { partner: null, candidates: includes, reason: "포함 검색 파트너 후보가 여러 건입니다." };
  }

  return { partner: null, candidates: [], reason: "등록된 파트너사를 찾지 못했습니다." };
}

function matchContact(
  partnerId: string,
  name: string,
  phone: string | null,
  email: string | null,
  contacts: TechPartnerContactRow[]
): {
  contact: TechPartnerContactRow | null;
  candidates: TechPartnerContactRow[];
} {
  const scoped = contacts.filter((c) => c.partner_id === partnerId);
  const nameNorm = normalizeName(name);

  const byName = scoped.filter((c) => normalizeName(c.name) === nameNorm);
  if (byName.length === 1) return { contact: byName[0]!, candidates: byName };

  if (phone) {
    const byPhoneAndName = scoped.filter(
      (c) => phonesMatch(c.phone, phone) && normalizeName(c.name) === nameNorm
    );
    if (byPhoneAndName.length === 1) {
      return { contact: byPhoneAndName[0]!, candidates: byPhoneAndName };
    }
  }

  if (email) {
    const byEmailAndName = scoped.filter(
      (c) =>
        c.email?.trim().toLowerCase() === email.trim().toLowerCase() &&
        normalizeName(c.name) === nameNorm
    );
    if (byEmailAndName.length === 1) {
      return { contact: byEmailAndName[0]!, candidates: byEmailAndName };
    }
  }

  if (byName.length > 1) return { contact: null, candidates: byName };

  if (phone) {
    const phoneOnly = scoped.filter((c) => phonesMatch(c.phone, phone));
    if (phoneOnly.length === 1) return { contact: phoneOnly[0]!, candidates: phoneOnly };
    if (phoneOnly.length > 1) return { contact: null, candidates: phoneOnly };
  }

  return { contact: null, candidates: byName };
}

function summaryCompanyKey(participant: TechPartnerParticipantRecord): string {
  return participant.matched_partner_name ?? participant.company_name;
}

export function validateTechPartnerAnalysis(result: TechPartnerAnalysisResult): string | null {
  const { summary, participants } = result;
  const examTaken = participants.filter((p) => participantHasExamScore(p)).length;
  const bothMatched = participants.filter(
    (p) => p.in_roster && p.in_exam && participantHasExamScore(p)
  ).length;
  const rosterWithMarks = participants.filter((p) => p.in_roster && p.has_any_attendance_record);
  const totalAttendanceDays = participants.reduce((sum, p) => sum + (p.attendance_days ?? 0), 0);
  const rosterCount = participants.filter((p) => p.in_roster).length;
  const noExamOnly = participants.filter(
    (p) => !participantHasExamScore(p) && p.in_roster
  ).length;

  if (summary.exam_taken_count >= 20 && examTaken === 0) return ANALYSIS_ERROR_MESSAGE;
  if (rosterCount >= 20 && rosterWithMarks.length > 0 && totalAttendanceDays === 0) {
    return ANALYSIS_ERROR_MESSAGE;
  }
  if (rosterCount >= 20 && noExamOnly >= rosterCount && examTaken > 0) {
    return ANALYSIS_ERROR_MESSAGE;
  }
  if (summary.exam_taken_count >= 20 && bothMatched === 0) return ANALYSIS_ERROR_MESSAGE;

  return null;
}

export function validateTechPartnerParticipantsForSave(
  participants: Array<{
    in_roster: boolean;
    in_exam: boolean;
    has_any_attendance_record?: boolean;
    no_show?: boolean;
    attendance_days?: number | null;
    total_score?: number | null;
    converted_score?: number | null;
  }>,
  examFileRowCount?: number
): string | null {
  const rosterCount = participants.filter((p) => p.in_roster).length;
  const examTaken = participants.filter(
    (p) => p.total_score != null || p.converted_score != null
  ).length;
  const bothMatched = participants.filter(
    (p) =>
      p.in_roster &&
      p.in_exam &&
      (p.total_score != null || p.converted_score != null)
  ).length;
  const rosterWithMarks = participants.filter(
    (p) => p.in_roster && (p.has_any_attendance_record ?? (p.attendance_days ?? 0) > 0)
  );
  const totalAttendanceDays = participants.reduce((sum, p) => sum + (p.attendance_days ?? 0), 0);
  const expectedExam = examFileRowCount ?? examTaken;

  if (expectedExam >= 20 && examTaken === 0) return ANALYSIS_ERROR_MESSAGE;
  if (rosterCount >= 20 && rosterWithMarks.length > 0 && totalAttendanceDays === 0) {
    return ANALYSIS_ERROR_MESSAGE;
  }
  if (
    rosterCount >= 20 &&
    participants.filter((p) => !p.in_exam && p.in_roster).length >= rosterCount &&
    examTaken > 0
  ) {
    return ANALYSIS_ERROR_MESSAGE;
  }
  if (expectedExam >= 20 && bothMatched === 0) return ANALYSIS_ERROR_MESSAGE;

  return null;
}

export function analyzeTechPartnerTrainingUpload(input: {
  examRows: ParsedTechPartnerExamRow[];
  rosterRows: ParsedTechPartnerRosterRow[];
  partners: TechPartnerPartnerRow[];
  contacts: TechPartnerContactRow[];
}): TechPartnerAnalysisResult {
  const merged = new Map<string, TechPartnerParticipantRecord>();

  for (const roster of input.rosterRows) {
    merged.set(personMergeKey(roster.company_name, roster.participant_name), createFromRoster(roster));
  }

  for (const exam of input.examRows) {
    if (!examRowHasScore(exam) && !exam.company_name && !exam.participant_name) continue;

    const key = personMergeKey(exam.company_name, exam.participant_name);
    const existing = merged.get(key);
    if (existing) {
      applyExamFields(existing, exam);
    } else {
      merged.set(key, createFromExam(exam));
    }
  }

  const participants = Array.from(merged.values());

  for (const participant of participants) {
    finalizeEducationAndExamStatus(participant);
    enrichBeomilReviewParticipant(participant);

    const partnerMatch = matchPartner(participant.company_name, input.partners);
    participant.partner_candidates = partnerMatch.candidates.map((p) => ({
      id: p.id,
      company_name: p.company_name
    }));

    if (!partnerMatch.partner) {
      participant.match_status = "review";
      participant.match_action = "review";
      participant.needs_review = true;
      participant.review_reason = partnerMatch.reason ?? participant.review_reason;
      continue;
    }

    participant.matched_partner_id = partnerMatch.partner.id;
    participant.matched_partner_name = partnerMatch.partner.company_name;

    const contactMatch = matchContact(
      partnerMatch.partner.id,
      participant.participant_name,
      participant.phone,
      participant.email,
      input.contacts
    );
    participant.contact_candidates = contactMatch.candidates.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone
    }));
    participant.matched_contact_id = contactMatch.contact?.id ?? null;

    if (contactMatch.candidates.length > 1 && !contactMatch.contact) {
      participant.match_status = "review";
      participant.match_action = "review";
      participant.needs_review = true;
      participant.review_reason =
        participant.review_reason ?? "동일 파트너 내 담당자 후보가 여러 건입니다.";
      continue;
    }

    if (participant.needs_review) {
      participant.match_status = "review";
      participant.match_action = "review";
      continue;
    }

    participant.match_status = "matched";
    participant.match_action = "ready";
  }

  const partnerMap = new Map<string, TechPartnerPartnerSummary>();

  for (const p of participants) {
    const companyKey = summaryCompanyKey(p);
    const summary =
      partnerMap.get(companyKey) ??
      ({
        partner_id: p.matched_partner_id,
        company_name: companyKey,
        registered_count: 0,
        attended_count: 0,
        no_show_count: 0,
        exam_taken_count: 0,
        avg_total_score: null,
        avg_converted_score: null,
        max_total_score: null,
        min_total_score: null,
        needs_review: false,
        attendee_count: 0
      } satisfies TechPartnerPartnerSummary);

    if (p.in_roster) {
      summary.registered_count += 1;
      summary.attendee_count += 1;
    }
    if (p.in_roster && p.has_any_attendance_record) summary.attended_count += 1;
    if (p.in_roster && p.no_show) summary.no_show_count += 1;
    if (participantHasExamScore(p)) summary.exam_taken_count += 1;
    if (p.needs_review) summary.needs_review = true;

    if (p.matched_partner_id) summary.partner_id = p.matched_partner_id;
    partnerMap.set(companyKey, summary);
  }

  for (const summary of partnerMap.values()) {
    const scores = participants
      .filter(
        (p) => summaryCompanyKey(p) === summary.company_name && p.total_score != null
      )
      .map((p) => p.total_score!);
    const converted = participants
      .filter(
        (p) => summaryCompanyKey(p) === summary.company_name && p.converted_score != null
      )
      .map((p) => p.converted_score!);

    if (scores.length > 0) {
      summary.avg_total_score =
        Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      summary.max_total_score = Math.max(...scores);
      summary.min_total_score = Math.min(...scores);
    }
    if (converted.length > 0) {
      summary.avg_converted_score =
        Math.round((converted.reduce((a, b) => a + b, 0) / converted.length) * 10) / 10;
    }
  }

  const normal_match_count = participants.filter(
    (p) => p.in_roster && p.in_exam && participantHasExamScore(p)
  ).length;
  const result_only_count = participants.filter((p) => p.education_status === "result_only").length;
  const roster_only_count = participants.filter(
    (p) => p.in_roster && !participantHasExamScore(p) && p.has_any_attendance_record
  ).length;
  const attended_count = participants.filter(
    (p) => p.in_roster && p.has_any_attendance_record
  ).length;
  const no_show_count = participants.filter((p) => p.in_roster && p.no_show).length;
  const exam_taken_count = participants.filter((p) => participantHasExamScore(p)).length;
  const review_count = participants.filter((p) => p.needs_review).length;
  const no_exam_count = participants.filter(
    (p) => !participantHasExamScore(p) && (p.in_roster || p.no_show)
  ).length;

  const summary: TechPartnerAnalysisSummary = {
    training_name: TECH_PARTNER_TRAINING_SESSION.training_name,
    start_date: TECH_PARTNER_TRAINING_SESSION.start_date,
    end_date: TECH_PARTNER_TRAINING_SESSION.end_date,
    registered_count: input.rosterRows.length,
    attended_count,
    no_show_count,
    exam_taken_count,
    normal_match_count,
    review_count,
    result_only_count,
    roster_only_count,
    no_exam_count,
    partner_count: partnerMap.size,
    analysis_valid: true,
    analysis_error: null,
    roster_count: input.rosterRows.length,
    exam_count: exam_taken_count,
    matched_count: normal_match_count
  };

  const result: TechPartnerAnalysisResult = {
    summary,
    participants,
    partner_summaries: Array.from(partnerMap.values()).sort((a, b) =>
      a.company_name.localeCompare(b.company_name, "ko-KR")
    )
  };

  const validationError = validateTechPartnerAnalysis(result);
  if (validationError) {
    result.summary.analysis_valid = false;
    result.summary.analysis_error = validationError;
  }

  return result;
}

export function getTechPartnerTrainingKey(): string {
  return `${TECH_PARTNER_TRAINING_SESSION.training_name}|${TECH_PARTNER_TRAINING_SESSION.start_date}`;
}

export function isParticipantReviewRow(participant: TechPartnerParticipantRecord): boolean {
  return participant.needs_review;
}

export function isTechPartnerParticipantSaveable(participant: {
  match_action: TechPartnerMatchAction;
  matched_partner_id: string | null;
  in_roster: boolean;
  has_any_attendance_record?: boolean;
  correction_applied?: boolean;
  total_score?: number | null;
  converted_score?: number | null;
}): boolean {
  if (participant.match_action === "exclude") return false;
  if (!participant.matched_partner_id) return false;

  const hasAttendance =
    participant.has_any_attendance_record ||
    participant.in_roster ||
    participant.correction_applied;
  const hasExam =
    participant.total_score != null || participant.converted_score != null;

  return hasAttendance || hasExam;
}

export function isParticipantNoExamRow(participant: TechPartnerParticipantRecord): boolean {
  if (participantHasExamScore(participant)) return false;
  if (participant.education_status === "result_only") return false;
  return (
    participant.exam_status === "미응시" ||
    participant.exam_status === "결과없음" ||
    participant.no_show
  );
}
