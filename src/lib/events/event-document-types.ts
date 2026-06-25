/** 행사 자료 문서 유형 */
export const EVENT_DOCUMENT_TYPES = [
  "result_report",
  "presentation",
  "invitation",
  "attendance",
  "photo",
  "policy",
  "internal_prep",
  "archive",
  "other"
] as const;

export type EventDocumentType = (typeof EVENT_DOCUMENT_TYPES)[number];

export const EVENT_DOCUMENT_TYPE_LABEL: Record<EventDocumentType, string> = {
  result_report: "결과보고서",
  presentation: "발표자료",
  invitation: "초청장/안내문",
  attendance: "참석자/설문",
  photo: "사진",
  policy: "정책자료",
  internal_prep: "내부준비자료",
  archive: "대용량 보관파일",
  other: "기타"
};

/** 파일 상태 (일반 화면 노출 기준) */
export const EVENT_FILE_STATUS = [
  "representative",
  "normal",
  "internal",
  "draft",
  "old_version",
  "duplicate",
  "excluded"
] as const;

export type EventFileStatus = (typeof EVENT_FILE_STATUS)[number];

export const EVENT_FILE_STATUS_LABEL: Record<EventFileStatus, string> = {
  representative: "대표자료",
  normal: "일반자료",
  internal: "내부자료",
  draft: "작업본",
  old_version: "구버전",
  duplicate: "중복",
  excluded: "제외"
};

/** @deprecated file_status 사용 */
export const EVENT_UPLOAD_STATUS = [
  "upload_recommended",
  "review_needed",
  "exclude",
  "internal_only"
] as const;

/** @deprecated file_status 사용 */
export type EventUploadStatus = (typeof EVENT_UPLOAD_STATUS)[number];

/** @deprecated EVENT_FILE_STATUS_LABEL 사용 */
export const EVENT_UPLOAD_STATUS_LABEL: Record<EventUploadStatus, string> = {
  upload_recommended: "업로드 추천",
  review_needed: "확인 필요",
  exclude: "제외",
  internal_only: "내부자료"
};

/** 공개 범위 */
export const EVENT_VISIBILITY = ["internal_all", "admin_only"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITY)[number];

export const EVENT_VISIBILITY_LABEL: Record<EventVisibility, string> = {
  internal_all: "일반 표시",
  admin_only: "관리자 전용"
};

/** 행사당 대표 사진 최대 노출 수 */
export const MAX_REPRESENTATIVE_PHOTOS_PER_EVENT = 5;

/** 일반 행사 상세에 기본 노출되는 상태 */
export const PUBLIC_EVENT_FILE_STATUSES: EventFileStatus[] = ["representative", "normal"];

export function isPublicEventFileStatus(status: EventFileStatus | string | null | undefined): boolean {
  return PUBLIC_EVENT_FILE_STATUSES.includes(status as EventFileStatus);
}

export function normalizeEventVisibility(value: string | null | undefined): EventVisibility {
  if (value === "admin_only" || value === "internal") return "admin_only";
  return "internal_all";
}

export function legacyUploadStatusFromFileStatus(
  fileStatus: EventFileStatus,
  isRepresentative: boolean
): EventUploadStatus {
  if (fileStatus === "internal") return "internal_only";
  if (fileStatus === "excluded" || fileStatus === "duplicate" || fileStatus === "draft" || fileStatus === "old_version") {
    return "exclude";
  }
  if (isRepresentative || fileStatus === "representative") return "upload_recommended";
  return "review_needed";
}
