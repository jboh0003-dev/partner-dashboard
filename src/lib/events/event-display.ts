import type { PartnerEventDocument, PartnerEventRecord } from "@/types/event";

/** partner_events 실제 컬럼 (014 기준) */
export const PARTNER_EVENT_COLUMNS =
  "id, year, event_name, event_type, event_date, location, description, summary, related_partners, source_folder_name, created_at, updated_at";

/** 업로드 래퍼 폴더명 — event_name 정확 일치 시에만 목록에서 제외 */
const WRAPPER_EVENT_NAMES_EXACT = new Set([
  "_행사_업로드_1차_선별",
  "_행사_업로드_최소팩"
]);

export function isWrapperPartnerEvent(
  event: Pick<PartnerEventRecord, "event_name">
): boolean {
  return WRAPPER_EVENT_NAMES_EXACT.has(event.event_name.trim());
}

export function filterDisplayablePartnerEvents<T extends PartnerEventRecord>(events: T[]): T[] {
  return events.filter((event) => !isWrapperPartnerEvent(event));
}

export function eventTypeIncludes(
  eventType: string | null | undefined,
  keyword: string
): boolean {
  if (!eventType) return false;
  return eventType.includes(keyword);
}

function normalizeDocType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function matchesDocumentType(
  doc: Pick<PartnerEventDocument, "document_type">,
  ...types: string[]
): boolean {
  const docType = normalizeDocType(doc.document_type);
  if (!docType) return false;
  return types.some((type) => {
    const normalized = type.trim().toLowerCase();
    return docType === normalized || docType.includes(normalized);
  });
}

export type EventDocumentCounts = {
  document_count: number;
  representative_document_count: number;
  presentation_document_count: number;
  photo_document_count: number;
  attendance_document_count: number;
};

export function aggregateEventDocumentCounts(
  documents: PartnerEventDocument[]
): EventDocumentCounts {
  return {
    document_count: documents.length,
    representative_document_count: documents.filter((doc) => doc.is_representative === true).length,
    presentation_document_count: documents.filter((doc) =>
      matchesDocumentType(doc, "presentation", "발표자료")
    ).length,
    photo_document_count: documents.filter((doc) =>
      matchesDocumentType(doc, "photo", "사진")
    ).length,
    attendance_document_count: documents.filter((doc) =>
      matchesDocumentType(doc, "attendance", "참석자/설문")
    ).length
  };
}

export function sortEventDocumentsByUploadedAt(
  documents: PartnerEventDocument[]
): PartnerEventDocument[] {
  return [...documents].sort(
    (left, right) =>
      new Date(right.uploaded_at).getTime() - new Date(left.uploaded_at).getTime()
  );
}

export function groupDocumentsByEventId(
  documents: PartnerEventDocument[]
): Map<string, PartnerEventDocument[]> {
  const map = new Map<string, PartnerEventDocument[]>();
  for (const doc of documents) {
    if (!doc.event_id) continue;
    const list = map.get(doc.event_id) ?? [];
    list.push(doc);
    map.set(doc.event_id, list);
  }
  return map;
}
