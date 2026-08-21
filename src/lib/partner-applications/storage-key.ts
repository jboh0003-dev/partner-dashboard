import { randomUUID } from "crypto";

const SAFE_EXT = new Set(["pdf", "xlsx", "docx", "png", "jpg", "jpeg"]);

export function originalFileExtension(fileName: string): string {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  return SAFE_EXT.has(ext) ? ext : "bin";
}

export function buildApplicationDocumentStorageKey(
  applicationId: string,
  documentType: string,
  fileName: string
): string {
  const ext = originalFileExtension(fileName);
  return `${applicationId}/${documentType}/${randomUUID()}.${ext}`;
}

export function publicUploadErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid key|not allowed|payload too large/i.test(raw)) {
    return "파일 업로드에 실패했습니다. 다시 시도해 주세요.";
  }
  return "파일 업로드에 실패했습니다. 다시 시도해 주세요.";
}
