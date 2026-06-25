import type { PartnerEventDocument, PartnerEventRecord } from "@/types/event";
import {
  isPublicEventFileStatus,
  normalizeEventVisibility,
  type EventFileStatus
} from "@/lib/events/event-document-types";

function resolveFileStatus(
  doc: Pick<PartnerEventDocument, "file_status" | "upload_status" | "is_representative">
): EventFileStatus | string | null {
  if (doc.file_status) return doc.file_status;
  if (doc.is_representative) return "representative";
  if (doc.upload_status === "internal_only") return "internal";
  if (doc.upload_status === "exclude") return "excluded";
  return "normal";
}

/** 일반 사용자·오케 AI 노출용 행사 */
export function isPublicPartnerEvent(
  event: Pick<PartnerEventRecord, "visibility">
): boolean {
  return normalizeEventVisibility(event.visibility) !== "admin_only";
}

/** 일반 행사 화면·오케 검색 노출용 자료 */
export function isPublicEventDocument(
  doc: Pick<
    PartnerEventDocument,
    | "is_active"
    | "is_representative"
    | "is_internal"
    | "is_duplicate"
    | "upload_status"
    | "file_status"
    | "visibility"
    | "document_type"
  >
): boolean {
  if (doc.is_active === false) return false;
  if (doc.is_duplicate === true) return false;

  const visibility = normalizeEventVisibility(doc.visibility);
  if (visibility === "admin_only" || doc.is_internal === true) return false;

  const fileStatus = resolveFileStatus(doc);
  if (!fileStatus || !isPublicEventFileStatus(fileStatus)) return false;

  if (doc.document_type === "photo") {
    return doc.is_representative === true || fileStatus === "representative";
  }

  return true;
}

export function filterPublicEventDocuments<T extends PartnerEventDocument>(docs: T[]): T[] {
  return docs.filter(isPublicEventDocument);
}

export function groupPublicEventDocuments(docs: PartnerEventDocument[]) {
  const publicDocs = filterPublicEventDocuments(docs);
  return {
    representative: publicDocs.filter(
      (doc) =>
        resolveFileStatus(doc) === "representative" ||
        (doc.is_representative === true && doc.document_type !== "photo")
    ),
    normal: publicDocs.filter(
      (doc) =>
        resolveFileStatus(doc) === "normal" &&
        doc.document_type !== "photo" &&
        doc.is_representative !== true
    ),
    photos: publicDocs.filter((doc) => doc.document_type === "photo")
  };
}

export function isAdminOnlyEventDocument(
  doc: Pick<
    PartnerEventDocument,
    "file_status" | "upload_status" | "visibility" | "is_internal" | "is_representative"
  >
): boolean {
  const visibility = normalizeEventVisibility(doc.visibility);
  if (visibility === "admin_only" || doc.is_internal) return true;
  const fileStatus = resolveFileStatus(doc);
  return !fileStatus || !isPublicEventFileStatus(fileStatus);
}

export function sortEventDocumentsForDisplay(docs: PartnerEventDocument[]): PartnerEventDocument[] {
  return [...docs].sort((left, right) => {
    const leftRep = left.is_representative ? 1 : 0;
    const rightRep = right.is_representative ? 1 : 0;
    if (leftRep !== rightRep) return rightRep - leftRep;
    return new Date(right.uploaded_at).getTime() - new Date(left.uploaded_at).getTime();
  });
}
