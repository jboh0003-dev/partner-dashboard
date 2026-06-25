import type { EventFileStatus } from "@/lib/events/event-document-types";

/** 행사 자료 Storage 업로드 허용 최대 크기 (50MB) */
export const EVENT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function isEventFileOversized(fileSize: number | null | undefined): boolean {
  return (fileSize ?? 0) > EVENT_MAX_UPLOAD_BYTES;
}

export function rowIsOversized(row: {
  fileSize?: number | null;
  excludeReason?: string | null;
}): boolean {
  return isEventFileOversized(row.fileSize) || row.excludeReason === "파일 용량 초과";
}

/** 스캔 직후 기본 저장 선택 여부 */
export function defaultUploadSelected(row: {
  fileStatus: EventFileStatus;
  fileSize?: number | null;
  excludeReason?: string | null;
}): boolean {
  if (rowIsOversized(row)) return false;
  return row.fileStatus === "representative";
}

export function formatEventFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
