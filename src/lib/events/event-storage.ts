import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const EVENT_DOCUMENTS_BUCKET = "event-documents";

/** 한 번의 업로드 커밋(배치) 단위 ID */
export function createEventUploadBatchId(): string {
  return randomUUID();
}

function sanitizeExtension(ext: string | null | undefined): string {
  if (!ext?.trim()) return "";
  return ext.trim().replace(/^\./, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** DB·화면용 원본 확장자에서 Storage key에 쓸 안전한 확장자 추출 */
export function resolveEventFileExtension(
  fileExtension: string | null | undefined,
  originalFilename: string
): string {
  const fromField = sanitizeExtension(fileExtension);
  if (fromField) return fromField;

  const match = originalFilename.match(/\.([a-zA-Z0-9]+)$/);
  return match ? sanitizeExtension(match[1]) : "";
}

/**
 * Supabase Storage object key (버킷 내부 경로).
 * 예: {uploadBatchId}/{uuid}.pdf
 * 한글·공백·특수문자는 포함하지 않습니다.
 */
export function buildEventStoragePath(
  uploadBatchId: string,
  fileExtension: string | null | undefined,
  originalFilename: string
): string {
  const ext = resolveEventFileExtension(fileExtension, originalFilename);
  const suffix = ext ? `.${ext}` : "";
  return `${uploadBatchId}/${randomUUID()}${suffix}`;
}

export async function ensureEventDocumentsBucket() {
  const supabase = createAdminClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((bucket) => bucket.name === EVENT_DOCUMENTS_BUCKET);
  if (exists) return;

  const { error } = await supabase.storage.createBucket(EVENT_DOCUMENTS_BUCKET, {
    public: false
  });
  if (error && !error.message.includes("already exists")) {
    throw new Error(`event-documents 버킷 생성 실패: ${error.message}`);
  }
}
