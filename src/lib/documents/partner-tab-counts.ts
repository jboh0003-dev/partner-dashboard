import {
  groupDocumentsForPartnerTab,
  isVisibleDocument,
  type DocumentDuplicateRow
} from "@/lib/documents/duplicate-detection";
import type { PartnerDocument } from "@/types/document";
import type {
  PartnerTrainingHistoryItem,
  PartnerTrainingSessionGroup
} from "@/types/partner-detail";
import type { PartnerTrainingMonthly } from "@/types/partner";

function toDuplicateRow(doc: PartnerDocument): DocumentDuplicateRow {
  return {
    id: doc.id,
    partner_id: doc.partner_id,
    document_type: doc.document_type,
    original_filename: doc.original_filename,
    display_name: doc.display_name,
    file_name: doc.file_name,
    file_size: doc.file_size,
    created_at: doc.created_at,
    is_active: doc.is_active,
    is_duplicate: doc.is_duplicate,
    duplicate_of: doc.duplicate_of,
    priority_score: doc.priority_score
  };
}

export function countVisiblePartnerDocuments(documents: PartnerDocument[]): number {
  const active = documents.filter((doc) => !doc.deleted_at && isVisibleDocument(doc));
  return groupDocumentsForPartnerTab(active.map(toDuplicateRow)).length;
}

export function listVisiblePartnerDocuments(documents: PartnerDocument[]): PartnerDocument[] {
  const active = documents.filter((doc) => !doc.deleted_at && isVisibleDocument(doc));
  const groups = groupDocumentsForPartnerTab(active.map(toDuplicateRow));
  const byId = new Map(active.map((doc) => [doc.id, doc]));
  return groups
    .map((group) => byId.get(group.representative.id))
    .filter((doc): doc is PartnerDocument => !!doc);
}

export function countVisibleTrainingItems(
  sessions: PartnerTrainingSessionGroup[],
  trainings: PartnerTrainingHistoryItem[],
  monthly: PartnerTrainingMonthly[]
): number {
  const techSessionIds = new Set(sessions.filter((s) => s.is_tech_partner).map((s) => s.training_id));
  const legacyCount = trainings.filter((t) => !techSessionIds.has(t.training_id)).length;
  return sessions.filter((s) => s.is_tech_partner).length + legacyCount + monthly.length;
}
