import { createAdminClient } from "@/lib/supabase/admin";
import { EVENT_DOCUMENTS_BUCKET } from "@/lib/events/event-storage";

export const EVENT_DOCUMENT_SIGNED_URL_TTL_SECONDS = 600;

const PREVIEWABLE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg"]);

export type PartnerEventDocumentRecord = {
  id: string;
  event_id: string;
  storage_path: string | null;
  original_file_name: string | null;
  display_name: string;
  file_extension: string | null;
};

export function resolveEventDocumentExtension(
  doc: Pick<PartnerEventDocumentRecord, "file_extension" | "original_file_name">
): string {
  const fromField = doc.file_extension?.trim().replace(/^\./, "").toLowerCase();
  if (fromField) return fromField;

  const filename = doc.original_file_name ?? "";
  const match = filename.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

export function getEventDocumentDownloadFileName(doc: PartnerEventDocumentRecord): string {
  const original = doc.original_file_name?.trim();
  if (original) return original;

  const ext = resolveEventDocumentExtension(doc);
  const base = doc.display_name.trim() || "행사자료";
  if (ext && !base.toLowerCase().endsWith(`.${ext}`)) {
    return `${base}.${ext}`;
  }
  return base;
}

export function isPreviewableEventDocument(
  doc: Pick<PartnerEventDocumentRecord, "file_extension" | "original_file_name">
): boolean {
  return PREVIEWABLE_EXTENSIONS.has(resolveEventDocumentExtension(doc));
}

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
