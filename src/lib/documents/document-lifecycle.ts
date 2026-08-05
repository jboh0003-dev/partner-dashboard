import { createHash } from "crypto";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import {
  isMultiDocumentAllowed,
  isVisibleDocument,
  pickRepresentativeDocument
} from "@/lib/documents/duplicate-detection";
import { isSafeStorageObjectKey } from "@/lib/documents/storage-path";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DocumentStorageRow = {
  id: string;
  partner_id: string;
  document_type: string | null;
  storage_path: string | null;
  file_path: string | null;
  file_size: number | null;
  original_filename: string | null;
  display_name: string | null;
  file_name: string | null;
  created_at: string;
  received_date?: string | null;
  is_active?: boolean | null;
  is_duplicate?: boolean | null;
  file_hash?: string | null;
};

export function pickDocumentStoragePath(row: Pick<DocumentStorageRow, "storage_path" | "file_path">): string | null {
  const candidate = row.storage_path ?? row.file_path;
  if (candidate && isSafeStorageObjectKey(candidate)) return candidate;
  return null;
}

/** 삭제용: DB에 저장된 경로를 우선 사용 (업로드용 safe-key보다 관대) */
export function pickDocumentStoragePathForDelete(
  row: Pick<DocumentStorageRow, "storage_path" | "file_path">
): string | null {
  const safe = pickDocumentStoragePath(row);
  if (safe) return safe;

  const candidate = (row.storage_path ?? row.file_path ?? "").trim();
  if (!candidate) return null;
  if (candidate.includes("..") || candidate.startsWith("/") || candidate.includes("\\")) {
    return null;
  }
  return candidate;
}

function isStorageNotFoundError(message: string | undefined): boolean {
  if (!message) return false;
  return /not\s*found|does\s*not\s*exist|no\s*such\s*(object|file)|404/i.test(message);
}

export async function removeDocumentStorage(
  supabase: SupabaseClient,
  storagePath: string | null | undefined
): Promise<{ ok: boolean; path: string | null; error?: string }> {
  const path = (storagePath ?? "").trim();
  if (!path) {
    return { ok: true, path: null };
  }
  if (path.includes("..") || path.startsWith("/") || path.includes("\\")) {
    return { ok: false, path, error: "유효하지 않은 Storage 경로입니다." };
  }

  const { error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).remove([path]);
  if (error) {
    if (isStorageNotFoundError(error.message)) {
      return { ok: true, path };
    }
    return { ok: false, path, error: error.message };
  }
  return { ok: true, path };
}

export async function deletePartnerDocumentHard(
  supabase: SupabaseClient,
  documentId: string
): Promise<{ ok: boolean; deletedStorage: string[]; errors: string[] }> {
  const { data, error } = await supabase
    .from("partner_documents")
    .select("id, storage_path, file_path, partner_id")
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, deletedStorage: [], errors: [error?.message ?? "문서를 찾을 수 없습니다."] };
  }

  const deletedStorage: string[] = [];
  const errors: string[] = [];

  // duplicate_of FK(ON DELETE NO ACTION) 때문에 자식이 있으면 대표 문서 DB 삭제가 실패함
  const { data: dupChildren, error: dupError } = await supabase
    .from("partner_documents")
    .select("id, storage_path, file_path")
    .eq("duplicate_of", documentId);

  if (dupError) {
    return {
      ok: false,
      deletedStorage: [],
      errors: [`중복 문서 조회 실패: ${dupError.message}`]
    };
  }

  for (const child of dupChildren ?? []) {
    const childPath = pickDocumentStoragePathForDelete(child);
    if (childPath) {
      const removedChild = await removeDocumentStorage(supabase, childPath);
      if (removedChild.ok) deletedStorage.push(childPath);
      else {
        errors.push(
          `중복 문서 Storage 삭제 실패 (${childPath}): ${removedChild.error ?? "알 수 없는 오류"}`
        );
        return { ok: false, deletedStorage, errors };
      }
    }

    const { error: childDeleteError } = await supabase
      .from("partner_documents")
      .delete()
      .eq("id", child.id);
    if (childDeleteError) {
      errors.push(`중복 문서 DB 삭제 실패: ${childDeleteError.message}`);
      return { ok: false, deletedStorage, errors };
    }
  }

  const storagePath = pickDocumentStoragePathForDelete(data);

  if (storagePath) {
    const removed = await removeDocumentStorage(supabase, storagePath);
    if (removed.ok) deletedStorage.push(storagePath);
    else {
      errors.push(`Storage 삭제 실패 (${storagePath}): ${removed.error ?? "알 수 없는 오류"}`);
      return { ok: false, deletedStorage, errors };
    }
  }

  const { error: deleteError } = await supabase.from("partner_documents").delete().eq("id", documentId);
  if (deleteError) {
    errors.push(`DB 삭제 실패: ${deleteError.message}`);
    return { ok: false, deletedStorage, errors };
  }

  return { ok: true, deletedStorage, errors };
}

export async function findCanonicalDocumentForType(
  supabase: SupabaseClient,
  partnerId: string,
  documentType: string
): Promise<DocumentStorageRow | null> {
  const { data, error } = await supabase
    .from("partner_documents")
    .select(
      "id, partner_id, document_type, storage_path, file_path, file_size, original_filename, display_name, file_name, created_at, received_date, is_active, is_duplicate, file_hash"
    )
    .eq("partner_id", partnerId)
    .eq("document_type", documentType)
    .eq("is_active", true)
    .eq("is_duplicate", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error || !data?.length) return null;
  const visible = (data as DocumentStorageRow[]).filter((row) => isVisibleDocument(row));
  if (!visible.length) return null;
  return pickRepresentativeDocument(visible);
}

export async function purgeSupersededDocumentsForType(
  supabase: SupabaseClient,
  partnerId: string,
  documentType: string,
  keepDocumentId: string
): Promise<{ removedIds: string[]; deletedStorage: string[]; errors: string[] }> {
  if (isMultiDocumentAllowed({ document_type: documentType, original_filename: null })) {
    return { removedIds: [], deletedStorage: [], errors: [] };
  }

  const { data, error } = await supabase
    .from("partner_documents")
    .select("id, storage_path, file_path")
    .eq("partner_id", partnerId)
    .eq("document_type", documentType)
    .neq("id", keepDocumentId)
    .is("deleted_at", null);

  if (error) {
    return { removedIds: [], deletedStorage: [], errors: [error.message] };
  }

  const removedIds: string[] = [];
  const deletedStorage: string[] = [];
  const errors: string[] = [];

  for (const row of data ?? []) {
    const storagePath = pickDocumentStoragePath(row);
    if (storagePath) {
      const removed = await removeDocumentStorage(supabase, storagePath);
      if (removed.ok) deletedStorage.push(storagePath);
      else if (removed.error) errors.push(removed.error);
    }

    const { error: deleteError } = await supabase.from("partner_documents").delete().eq("id", row.id);
    if (deleteError) {
      errors.push(`문서 ${row.id} DB 삭제 실패: ${deleteError.message}`);
      continue;
    }
    removedIds.push(String(row.id));
  }

  return { removedIds, deletedStorage, errors };
}

export function computeFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export type DuplicateCleanupCandidate = {
  partner_id: string;
  partner_name: string;
  document_type: string;
  keep_id: string;
  keep_filename: string;
  remove: Array<{
    id: string;
    filename: string;
    storage_path: string | null;
    file_size: number | null;
    created_at: string;
  }>;
};

export function buildDuplicateCleanupPlan(
  documents: Array<
    DocumentStorageRow & {
      partner_name?: string;
    }
  >
): DuplicateCleanupCandidate[] {
  const groups = new Map<string, typeof documents>();

  for (const doc of documents) {
    if (!doc.document_type) continue;
    if (isMultiDocumentAllowed(doc)) continue;
    const key = `${doc.partner_id}:${doc.document_type}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(doc);
    groups.set(key, bucket);
  }

  const plan: DuplicateCleanupCandidate[] = [];

  for (const bucket of groups.values()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort((left, right) => {
      const leftTime = new Date(left.received_date ?? left.created_at).getTime();
      const rightTime = new Date(right.received_date ?? right.created_at).getTime();
      return rightTime - leftTime;
    });
    const keep = sorted[0]!;
    const remove = sorted.slice(1).map((doc) => ({
      id: doc.id,
      filename: doc.display_name ?? doc.file_name ?? doc.original_filename ?? "-",
      storage_path: pickDocumentStoragePath(doc),
      file_size: doc.file_size ?? null,
      created_at: doc.created_at
    }));

    plan.push({
      partner_id: keep.partner_id,
      partner_name: keep.partner_name ?? "",
      document_type: keep.document_type ?? "other",
      keep_id: keep.id,
      keep_filename: keep.display_name ?? keep.file_name ?? keep.original_filename ?? "-",
      remove
    });
  }

  return plan.sort((left, right) => left.partner_name.localeCompare(right.partner_name, "ko-KR"));
}

export function summarizeCleanupPlan(plan: DuplicateCleanupCandidate[]) {
  const partnerIds = new Set(plan.map((item) => item.partner_id));
  const removeDocs = plan.reduce((sum, item) => sum + item.remove.length, 0);
  const removeFiles = plan.reduce(
    (sum, item) => sum + item.remove.filter((doc) => doc.storage_path).length,
    0
  );
  const estimatedBytes = plan.reduce(
    (sum, item) => sum + item.remove.reduce((inner, doc) => inner + (doc.file_size ?? 0), 0),
    0
  );

  return {
    duplicate_partner_count: partnerIds.size,
    duplicate_document_count: removeDocs,
    delete_file_count: removeFiles,
    estimated_bytes: estimatedBytes
  };
}

export function usesCanonicalTypeStorage(
  documentType: string | null,
  originalFilename?: string | null
): boolean {
  return !isMultiDocumentAllowed({
    document_type: documentType,
    original_filename: originalFilename ?? null
  });
}
