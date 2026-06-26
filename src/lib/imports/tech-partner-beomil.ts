import type { TechPartnerParticipantRecord } from "@/lib/imports/tech-partner-training";

const BEOMIL_COMPANY_PATTERN = /범일정보/;

export function isBeomilCompany(companyName: string): boolean {
  return BEOMIL_COMPANY_PATTERN.test(companyName);
}

export function buildBeomilCorrectionOverrides(
  participants: TechPartnerParticipantRecord[]
): Record<string, Partial<TechPartnerParticipantRecord>> {
  const overrides: Record<string, Partial<TechPartnerParticipantRecord>> = {};

  for (const participant of participants) {
    if (!isBeomilCompany(participant.company_name)) continue;

    if (participant.participant_name === "이지환") {
      overrides[participant.key] = {
        education_status: "partial_attended",
        attendance_scope: "2주차",
        has_any_attendance_record: true,
        no_show: false,
        exam_status: "미응시",
        total_score: null,
        converted_score: null,
        rank: null,
        manual_correction_note: "교육팀 확인: 2주차 참석, 미응시",
        correction_applied: true,
        needs_review: true,
        review_reason: "교육팀 확인에 따른 이름 변경/참석기간 분리 필요",
        review_category: "beomil_manual",
        match_action: "ready",
        match_status: "matched"
      };
    }

    if (participant.participant_name === "김동현") {
      overrides[participant.key] = {
        education_status: "partial_attended",
        attendance_scope: "3~4주차",
        has_any_attendance_record: true,
        no_show: false,
        in_roster: false,
        in_exam: true,
        exam_status: "응시",
        total_score: participant.total_score ?? 19.5,
        converted_score: participant.converted_score ?? 32.5,
        manual_correction_note: "교육팀 확인: 3~4주차 참석, 응시",
        correction_applied: true,
        needs_review: true,
        review_reason: "교육팀 확인에 따른 이름 변경/참석기간 분리 필요",
        review_category: "beomil_manual",
        match_action: "ready",
        match_status: "matched"
      };
    }
  }

  return overrides;
}

export function enrichBeomilReviewParticipant(participant: TechPartnerParticipantRecord): void {
  if (!isBeomilCompany(participant.company_name)) return;

  if (participant.participant_name === "이지환" && participant.in_roster) {
    participant.review_category = "beomil_manual";
    participant.review_reason = "출석부에는 있으나 시험결과 없음";
    participant.needs_review = true;
    participant.match_status = "review";
    participant.match_action = "review";
  }

  if (participant.participant_name === "김동현" && participant.education_status === "result_only") {
    participant.review_category = "beomil_manual";
    participant.review_reason = "시험결과에는 있으나 출석부 이름 없음";
    participant.needs_review = true;
    participant.match_status = "review";
    participant.match_action = "review";
  }
}

export function getBeomilReviewDisplay(participant: TechPartnerParticipantRecord): string[] {
  if (!isBeomilCompany(participant.company_name)) {
    return participant.review_reason ? [participant.review_reason] : [];
  }

  if (participant.participant_name === "이지환") {
    return [
      participant.review_reason ?? "출석부에는 있으나 시험결과 없음",
      "교육팀 확인: 2주차 참석, 미응시"
    ];
  }

  if (participant.participant_name === "김동현") {
    return [
      participant.review_reason ?? "시험결과에는 있으나 출석부 이름 없음",
      "교육팀 확인: 3~4주차 참석, 응시"
    ];
  }

  return participant.review_reason ? [participant.review_reason] : [];
}
