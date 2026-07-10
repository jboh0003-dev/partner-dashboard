/** 업로드 유형 — import_jobs.import_type 및 UI 키와 대응 */
export const UPLOAD_TYPE = {
  PARTNER_MASTER: "partner_master_upload",
  CONTACT_FULL_DB: "contact_full_db_upload",
  EDUCATION_ATTENDEE: "education_attendee_upload",
  EVENT_ATTENDEE: "event_attendee_upload"
} as const;

export type UploadTypeKey = (typeof UPLOAD_TYPE)[keyof typeof UPLOAD_TYPE];

/** 레거시 import_type → 신규 키 */
export const LEGACY_IMPORT_TYPE_MAP: Record<string, UploadTypeKey> = {
  partner_master: UPLOAD_TYPE.PARTNER_MASTER,
  partner_contacts: UPLOAD_TYPE.CONTACT_FULL_DB,
  training_attendance_detail: UPLOAD_TYPE.EDUCATION_ATTENDEE,
  tech_partner_training: UPLOAD_TYPE.EDUCATION_ATTENDEE
};

export function normalizeImportType(value: string): UploadTypeKey | string {
  return LEGACY_IMPORT_TYPE_MAP[value] ?? value;
}

export const UPLOAD_TYPE_LABEL: Record<UploadTypeKey, string> = {
  [UPLOAD_TYPE.PARTNER_MASTER]: "파트너 기본정보 갱신",
  [UPLOAD_TYPE.CONTACT_FULL_DB]: "현재 인력/담당자 baseline reset",
  [UPLOAD_TYPE.EDUCATION_ATTENDEE]: "교육 참석 이력 추가",
  [UPLOAD_TYPE.EVENT_ATTENDEE]: "행사 참석 이력 추가"
};
