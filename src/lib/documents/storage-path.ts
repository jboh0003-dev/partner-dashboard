import { createHash, randomUUID } from "crypto";

const SAFE_OBJECT_KEY_PATTERN = /^[0-9a-f-]{36}\.[a-z0-9]+$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sanitizeFileExt(fileExt: string): string {
  const ext = fileExt.trim().replace(/^\./, "").toLowerCase();
  if (!ext || !/^[a-z0-9]+$/.test(ext)) return "bin";
  return ext;
}

export function sanitizeDocumentTypeSegment(documentType: string): string {
  const cleaned = documentType.trim().replace(/[^a-z0-9_]/gi, "");
  return cleaned || "other";
}

export function sanitizePartnerIdSegment(partnerId: string): string {
  const trimmed = partnerId.trim();
  if (!UUID_PATTERN.test(trimmed)) {
    throw new Error("유효하지 않은 partner_id 입니다.");
  }
  return trimmed;
}

/** Storage object key — bucket 제외, ASCII only */
export function buildDocumentStoragePath(
  partnerId: string,
  documentType: string,
  fileExt: string
): string {
  const safePartnerId = sanitizePartnerIdSegment(partnerId);
  const safeDocumentType = sanitizeDocumentTypeSegment(documentType);
  const ext = sanitizeFileExt(fileExt);
  const objectId = randomUUID();
  return `${safePartnerId}/${safeDocumentType}/${objectId}.${ext}`;
}

/**
 * 동일 partner + 문서유형 + 원본파일명은 항상 같은 Storage key를 사용한다.
 * DB 저장 실패 후 재업로드 시 orphan 파일이 늘어나지 않도록 upsert 대상을 고정한다.
 */
export function buildDeterministicStoragePath(
  partnerId: string,
  documentType: string,
  fileExt: string,
  originalFilename: string
): string {
  const safePartnerId = sanitizePartnerIdSegment(partnerId);
  const safeDocumentType = sanitizeDocumentTypeSegment(documentType);
  const ext = sanitizeFileExt(fileExt);
  const digest = createHash("sha256")
    .update(`${safePartnerId}\0${safeDocumentType}\0${originalFilename}`, "utf8")
    .digest("hex");
  const objectId = [
    digest.slice(0, 8),
    digest.slice(8, 12),
    digest.slice(12, 16),
    digest.slice(16, 20),
    digest.slice(20, 32)
  ].join("-");

  return `${safePartnerId}/${safeDocumentType}/${objectId}.${ext}`;
}

export function resolveUploadStoragePath(
  partnerId: string,
  documentType: string,
  fileExt: string,
  originalFilename: string,
  existingStoragePath?: string | null,
  existingFilePath?: string | null
): string {
  const existing = existingStoragePath ?? existingFilePath ?? null;
  if (existing && isSafeStorageObjectKey(existing)) {
    return existing;
  }

  return buildDeterministicStoragePath(partnerId, documentType, fileExt, originalFilename);
}

export function isSafeStorageObjectKey(storagePath: string): boolean {
  if (!storagePath.trim()) return false;
  if (/[^\x00-\x7F]/.test(storagePath)) return false;
  if (/[\s()[\]{}#?%&]/.test(storagePath)) return false;

  const segments = storagePath.split("/");
  if (segments.length !== 3) return false;

  const [partnerId, documentType, filename] = segments;
  if (!partnerId || !documentType || !filename) return false;
  if (!UUID_PATTERN.test(partnerId)) return false;
  if (!/^[a-z0-9_]+$/i.test(documentType)) return false;

  return SAFE_OBJECT_KEY_PATTERN.test(filename);
}

export function coerceSafeStoragePath(
  partnerId: string,
  documentType: string,
  fileExt: string,
  candidate?: string | null
): string {
  if (candidate && isSafeStorageObjectKey(candidate)) {
    return candidate;
  }
  return buildDocumentStoragePath(partnerId, documentType, fileExt);
}
