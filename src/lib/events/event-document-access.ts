import { createAdminClient } from "@/lib/supabase/admin";
import { EVENT_DOCUMENTS_BUCKET } from "@/lib/events/event-storage";

export const EVENT_DOCUMENT_SIGNED_URL_TTL_SECONDS = 600;

export { resolveEventDocumentExtension, getEventDocumentDownloadFileName, isPreviewableEventDocument } from './event-document-presentation';
import { getEventDocumentDownloadFileName } from './event-document-presentation';
import type { PartnerEventDocumentRecord } from './event-document-presentation';
export type { PartnerEventDocumentRecord } from './event-document-presentation';

function isSafeEventStoragePath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed || trimmed.startsWith("/") || trimmed.includes("..")) return false;
  return true;
}

export async function fetchPartnerEventDocumentRecord(
  id: string
): Promise<{ document: PartnerEventDocumentRecord | null; error?: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_event_documents")
    .select("id, event_id, storage_path, original_file_name, display_name, file_extension")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return { document: null, error: error?.message ?? "문서를 찾을 수 없습니다." };
  }

  if (!data.storage_path || !isSafeEventStoragePath(data.storage_path)) {
    return { document: null, error: "유효한 Storage 경로가 없습니다." };
  }

  return { document: data as PartnerEventDocumentRecord };
}

export async function createEventDocumentSignedUrl(
  doc: PartnerEventDocumentRecord,
  mode: "inline" | "attachment"
): Promise<{ url: string | null; error?: string }> {
  const storagePath = doc.storage_path?.trim();
  if (!storagePath || !isSafeEventStoragePath(storagePath)) {
    return { url: null, error: "유효한 Storage 경로가 없습니다." };
  }

  const supabase = createAdminClient();
  const filename = getEventDocumentDownloadFileName(doc);
  const { data, error } = await supabase.storage
    .from(EVENT_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, EVENT_DOCUMENT_SIGNED_URL_TTL_SECONDS, {
      download: mode === "attachment" ? filename : false
    });

  if (error || !data?.signedUrl) {
    return { url: null, error: error?.message ?? "Signed URL 생성에 실패했습니다." };
  }

  return { url: data.signedUrl };
}
