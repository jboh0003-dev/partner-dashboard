import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import {
  getDocumentContentType,
  getDocumentDownloadFileName,
  type DocumentDisplaySource
} from "@/lib/documents/display";
import { isSafeStorageObjectKey } from "@/lib/documents/storage-path";
import { createAdminClient } from "@/lib/supabase/admin";

export type PartnerDocumentRecord = DocumentDisplaySource & {
  id: string;
  storage_path: string | null;
  file_path: string | null;
  deleted_at: string | null;
};

export async function fetchPartnerDocumentRecord(
  id: string
): Promise<{ document: PartnerDocumentRecord | null; error?: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_documents")
    .select(
      "id, storage_path, file_path, original_filename, file_name, display_name, file_ext, document_type, deleted_at"
    )
    .eq("id", id)
    .single();

  if (error || !data || data.deleted_at) {
    return { document: null, error: "문서를 찾을 수 없습니다." };
  }

  return { document: data as PartnerDocumentRecord };
}

export function resolveDocumentStoragePath(document: PartnerDocumentRecord): string | null {
  const storagePath = [document.storage_path, document.file_path].find(
    (value): value is string => !!value && isSafeStorageObjectKey(value)
  );
  return storagePath ?? null;
}

export async function downloadPartnerDocumentBlob(document: PartnerDocumentRecord) {
  const storagePath = resolveDocumentStoragePath(document);
  if (!storagePath) {
    return { blob: null as Blob | null, error: "유효한 Storage 경로가 없습니다. 문서를 다시 업로드해 주세요." };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).download(storagePath);

  if (error || !data) {
    return { blob: null as Blob | null, error: error?.message ?? "파일을 불러오지 못했습니다." };
  }

  return { blob: data, error: undefined };
}

export function buildContentDisposition(
  filename: string,
  disposition: "inline" | "attachment"
): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_") || "document";
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function buildDocumentResponseHeaders(
  document: PartnerDocumentRecord,
  disposition: "inline" | "attachment"
): HeadersInit {
  const filename = getDocumentDownloadFileName(document);
  return {
    "Content-Type": getDocumentContentType(document),
    "Content-Disposition": buildContentDisposition(filename, disposition),
    "Cache-Control": "private, no-store"
  };
}
