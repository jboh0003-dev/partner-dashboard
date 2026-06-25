import type {
  EventDocumentType,
  EventFileStatus,
  EventVisibility
} from "@/lib/events/event-document-types";

export type PartnerEventRecord = {
  id: string;
  year: number | null;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  description: string | null;
  summary: string | null;
  related_partners: string | null;
  source_folder_name: string | null;
  created_at: string;
  updated_at: string;
  /** 마이그레이션 미적용 환경 호환용 (조회·표시에 사용하지 않음) */
  event_date_start?: string | null;
  event_date_end?: string | null;
  keywords?: string | null;
  visibility?: EventVisibility | string | null;
};

export type PartnerEventDocument = {
  id: string;
  event_id: string;
  document_type: EventDocumentType | string | null;
  display_name: string;
  original_file_name: string | null;
  storage_path: string | null;
  file_extension: string | null;
  file_size: number | null;
  version_label: string | null;
  is_representative: boolean | null;
  is_active: boolean | null;
  is_internal: boolean | null;
  is_duplicate: boolean | null;
  exclude_reason: string | null;
  file_status: EventFileStatus | string | null;
  upload_status: string | null;
  source_path: string | null;
  visibility: EventVisibility | string | null;
  uploaded_at: string;
};

export type PartnerEventCurationItem = {
  id: string;
  event_id: string | null;
  source_folder_name: string;
  source_path: string;
  original_filename: string;
  file_extension: string | null;
  file_size: number | null;
  document_type: string | null;
  file_status: EventFileStatus | string | null;
  upload_status: string | null;
  exclude_reason: string | null;
  display_name: string | null;
  version_label: string | null;
  is_representative: boolean | null;
  upload_selected: boolean | null;
  visibility: EventVisibility | string | null;
  committed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerEventWithDocs = PartnerEventRecord & {
  documents: PartnerEventDocument[];
  all_documents: PartnerEventDocument[];
  document_count: number;
  public_document_count: number;
  all_document_count: number;
  representative_document_count: number;
  presentation_document_count: number;
  photo_document_count: number;
  attendance_document_count: number;
  normal_document_count: number;
  internal_document_count: number;
};

/** @deprecated partner_events 사용. 하위 호환용 */
export type PartnerEvent = {
  id: string;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  memo: string | null;
  created_at: string;
};

export type EventAttendance = {
  id: string;
  partner_id: string;
  event_id: string;
  attendee_name: string | null;
  attendee_department: string | null;
  attendee_position: string | null;
  attendee_email: string | null;
  attended: boolean;
  memo: string | null;
  created_at: string;
};

export type EventCurationReviewRow = {
  rowId: string;
  eventFolderName: string;
  eventName: string;
  eventType: string;
  eventDate: string | null;
  eventYear: number | null;
  originalFilename: string;
  sourcePath: string;
  fileExtension: string | null;
  fileSize: number | null;
  documentType: EventDocumentType;
  fileStatus: EventFileStatus;
  excludeReason: string | null;
  displayName: string;
  versionLabel: string | null;
  visibility: EventVisibility;
  isRepresentative: boolean;
  /** Storage 저장 대상 선택 (체크박스) */
  uploadSelected: boolean;
};
