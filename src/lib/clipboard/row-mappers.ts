import { getContactAssignmentLabel } from "@/lib/contacts/display";
import type { CopyableRow } from "@/lib/clipboard/table-copy";
import type { ContactTableRow } from "@/components/contacts/contacts-table";
import type { PartnerListRow } from "@/lib/partners/list";
import type { TrainingAttendeeRow } from "@/components/trainings/training-attendees-table";
import type { RecruitmentRow } from "@/lib/trainings/recruitment";
import type { TechPartnerParticipantRecord } from "@/lib/imports/tech-partner-training";
import { PARTNER_GRADE_LABEL } from "@/lib/constants";

export function contactRowToCopyable(row: ContactTableRow): CopyableRow {
  return {
    id: row.id,
    companyName: row.company_name,
    name: row.name,
    role: getContactAssignmentLabel({
      role_type: row.role_type,
      is_contract_contact: row.is_contract_contact
    }),
    position: [row.department, row.position].filter(Boolean).join(" / ") || null,
    phone: row.phone,
    email: row.email
  };
}

export const CONTACT_SELECTED_ROW_TSV = {
  headers: ["회사명", "이름", "역할", "직급", "연락처", "이메일"],
  getValues: (row: CopyableRow) => [
    row.companyName ?? "",
    row.name ?? "",
    row.role ?? "",
    row.position ?? "",
    row.phone ?? "",
    row.email ?? ""
  ]
} as const;

export function partnerRowToCopyable(row: PartnerListRow): CopyableRow {
  return {
    id: row.partner.id,
    companyName: row.partner.company_name,
    name: row.contactName,
    role:
      PARTNER_GRADE_LABEL[row.partner.grade ?? "none"] ?? row.partner.grade ?? null,
    position: row.contactPosition,
    phone: row.contactPhone,
    email: row.contactEmail
  };
}

export const PARTNER_SELECTED_ROW_TSV = {
  headers: ["회사명", "등급", "담당자명", "직급", "연락처", "이메일"],
  getValues: (row: CopyableRow) => [
    row.companyName ?? "",
    row.role ?? "",
    row.name ?? "",
    row.position ?? "",
    row.phone ?? "",
    row.email ?? ""
  ]
} as const;

export function trainingAttendeeRowToCopyable(row: TrainingAttendeeRow): CopyableRow {
  return {
    id: row.id,
    companyName: row.partner_name,
    name: row.attendee_name,
    role: row.attendee_department,
    position: row.attendee_position,
    phone: row.attendee_phone,
    email: row.attendee_email
  };
}

export const TRAINING_ATTENDEE_SELECTED_ROW_TSV = {
  headers: ["회사명", "이름", "직급", "직무", "연락처", "이메일"],
  getValues: (row: CopyableRow) => [
    row.companyName ?? "",
    row.name ?? "",
    row.position ?? "",
    row.role ?? "",
    row.phone ?? "",
    row.email ?? ""
  ]
} as const;

export function recruitmentRowToCopyable(row: RecruitmentRow): CopyableRow {
  return {
    id: row.id,
    companyName: row.companyName,
    name: row.contactName,
    role: row.contactRoleLabel,
    position: row.contactPosition,
    phone: row.contactPhone,
    email: row.contactEmail,
    copyMeta: { grade: row.gradeLabel }
  };
}

export const RECRUITMENT_SELECTED_ROW_TSV = {
  headers: ["회사명", "등급", "담당자명", "직급", "역할", "연락처", "이메일"],
  getValues: (row: CopyableRow) => [
    row.companyName ?? "",
    row.copyMeta?.grade ?? "",
    row.name ?? "",
    row.position ?? "",
    row.role ?? "",
    row.phone ?? "",
    row.email ?? ""
  ]
} as const;

export function techPartnerParticipantToCopyable(
  row: TechPartnerParticipantRecord
): CopyableRow {
  return {
    id: row.key,
    companyName: row.matched_partner_name ?? row.company_name,
    name: row.participant_name,
    role: row.group_name,
    position: row.title,
    phone: row.phone,
    email: row.email,
    copyMeta: {
      attendance_days: row.attendance_days != null ? String(row.attendance_days) : "",
      exam_status: row.exam_status,
      total_score: row.total_score != null ? String(row.total_score) : "",
      converted_score: row.converted_score != null ? String(row.converted_score) : ""
    }
  };
}

export const TECH_PARTNER_PARTICIPANT_SELECTED_ROW_TSV = {
  headers: [
    "회사명",
    "이름",
    "직급",
    "전화번호",
    "출석일수",
    "응시",
    "총점",
    "환산점수"
  ],
  getValues: (row: CopyableRow) => [
    row.companyName ?? "",
    row.name ?? "",
    row.position ?? "",
    row.phone ?? "",
    row.copyMeta?.attendance_days ?? "",
    row.copyMeta?.exam_status ?? "",
    row.copyMeta?.total_score ?? "",
    row.copyMeta?.converted_score ?? ""
  ]
} as const;
