import {
  buildExactDuplicateGroups,
  buildNearDuplicateGroups,
  DUPLICATE_REASON,
  pickRepresentativeDocument,
  type DuplicateScanSummary
} from "@/lib/documents/duplicate-detection";
import { createAdminClient } from "@/lib/supabase/admin";

export type DocumentDuplicateRecord = {
  id: string;
  partner_id: string;
  document_type: string | null;
  original_filename: string | null;
  display_name: string | null;
  file_name: string | null;
  file_size: number | null;
  storage_path: string | null;
  created_at: string;
  is_active: boolean | null;
  is_duplicate: boolean | null;
  duplicate_of: string | null;
  duplicate_reason: string | null;
  representative: boolean | null;
  is_primary: boolean | null;
  priority_score: number | null;
  partner?: { company_name: string } | { company_name: string }[] | null;
};

export async function fetchAllDocumentsForDuplicateScan() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_documents")
    .select(
      "id, partner_id, document_type, original_filename, display_name, file_name, file_size, storage_path, created_at, is_active, is_duplicate, duplicate_of, duplicate_reason, representative, is_primary, priority_score, partner:partners(company_name)"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as DocumentDuplicateRecord[]).map((row) => {
    const partner = Array.isArray(row.partner) ? row.partner[0] : row.partner;
    return {
      ...row,
      partner_name: partner?.company_name ?? ""
    };
  });
}

export async function scanAndApplyDuplicateRules(): Promise<DuplicateScanSummary> {
  const documents = await fetchAllDocumentsForDuplicateScan();
  const supabase = createAdminClient();

  const exactGroups = buildExactDuplicateGroups(documents);
  const nearGroups = buildNearDuplicateGroups(documents);

  let exactHidden = 0;
  let nearCandidates = 0;
  let excluded = 0;

  for (const group of exactGroups) {
    if (group.classification !== "exact") {
      excluded += 1;
      continue;
    }

    const representative = pickRepresentativeDocument(group.documents);
    for (const doc of group.documents) {
      if (doc.id === representative.id) {
        await supabase
          .from("partner_documents")
          .update({
            is_active: true,
            is_duplicate: false,
            duplicate_of: null,
            representative: true,
            is_primary: true,
            duplicate_reason: null,
            archived_at: null,
            archived_reason: null
          })
          .eq("id", doc.id);
        continue;
      }

      await supabase
        .from("partner_documents")
        .update({
          is_active: false,
          is_duplicate: true,
          duplicate_of: representative.id,
          representative: false,
          is_primary: false,
          duplicate_reason: DUPLICATE_REASON.exact_auto,
          archived_at: new Date().toISOString(),
          archived_reason: "완전 중복 자동 숨김"
        })
        .eq("id", doc.id);
      exactHidden += 1;
    }
  }

  for (const group of nearGroups) {
    const alreadyExact = exactGroups.some((exact) => exact.key === group.key);
    if (alreadyExact) continue;

    nearCandidates += 1;
    const representative = pickRepresentativeDocument(group.documents);
    for (const doc of group.documents) {
      if (doc.id === representative.id) {
        await supabase
          .from("partner_documents")
          .update({
            representative: true,
            duplicate_reason: doc.duplicate_reason ?? DUPLICATE_REASON.near_candidate
          })
          .eq("id", doc.id);
        continue;
      }

      if (doc.is_duplicate && doc.duplicate_reason === DUPLICATE_REASON.exact_auto) continue;

      await supabase
        .from("partner_documents")
        .update({
          duplicate_reason: DUPLICATE_REASON.near_candidate,
          representative: false
        })
        .eq("id", doc.id);
    }
  }

  return {
    exact_hidden: exactHidden,
    near_candidates: nearCandidates,
    excluded,
    groups: exactGroups.length + nearGroups.length,
    scanned: documents.length
  };
}

export async function markDocumentRepresentative(documentId: string) {
  const supabase = createAdminClient();
  const { data: doc, error } = await supabase
    .from("partner_documents")
    .select("id, partner_id, document_type, display_name")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !doc) throw new Error(error?.message ?? "문서를 찾을 수 없습니다.");

  const siblings = await supabase
    .from("partner_documents")
    .select("id")
    .eq("partner_id", doc.partner_id)
    .eq("document_type", doc.document_type)
    .is("deleted_at", null);

  const ids = (siblings.data ?? []).map((row) => row.id as string);

  if (ids.length > 0) {
    await supabase
      .from("partner_documents")
      .update({ representative: false, is_primary: false })
      .in("id", ids);
  }

  await supabase
    .from("partner_documents")
    .update({
      is_active: true,
      is_duplicate: false,
      duplicate_of: null,
      representative: true,
      is_primary: true,
      duplicate_reason: null,
      archived_at: null,
      archived_reason: null
    })
    .eq("id", documentId);

  const hidden = await supabase
    .from("partner_documents")
    .select("id")
    .eq("duplicate_of", documentId)
    .is("deleted_at", null);

  for (const row of hidden.data ?? []) {
    await hideDocumentAsDuplicate(row.id as string, documentId, "대표 문서 지정에 따른 숨김");
  }
}

export async function hideDocumentAsDuplicate(
  documentId: string,
  duplicateOf: string,
  reason = "관리자 중복 숨김"
) {
  const supabase = createAdminClient();
  await supabase
    .from("partner_documents")
    .update({
      is_active: false,
      is_duplicate: true,
      duplicate_of: duplicateOf,
      representative: false,
      is_primary: false,
      duplicate_reason: DUPLICATE_REASON.manual_hidden,
      archived_at: new Date().toISOString(),
      archived_reason: reason
    })
    .eq("id", documentId);
}

export async function markDocumentNotDuplicate(documentId: string) {
  const supabase = createAdminClient();
  await supabase
    .from("partner_documents")
    .update({
      is_active: true,
      is_duplicate: false,
      duplicate_of: null,
      representative: true,
      duplicate_reason: DUPLICATE_REASON.not_duplicate,
      archived_at: null,
      archived_reason: null
    })
    .eq("id", documentId);
}

export async function fetchDuplicateGroupsForAdmin() {
  const documents = await fetchAllDocumentsForDuplicateScan();
  const exact = buildExactDuplicateGroups(documents);
  const near = buildNearDuplicateGroups(documents);

  const merged = [...exact, ...near.filter((group) => !exact.some((item) => item.key === group.key))];

  return {
    documents,
    groups: merged,
    summary: {
      total_candidates: merged.length,
      exact: exact.length,
      near: near.length,
      hidden: documents.filter((doc) => doc.is_duplicate && !doc.is_active).length,
      near_review: documents.filter((doc) => doc.duplicate_reason === DUPLICATE_REASON.near_candidate)
        .length
    }
  };
}
