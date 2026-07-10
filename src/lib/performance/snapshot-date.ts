import { parseSnapshotLabelToDate } from "@/lib/performance/format";

export function extractSnapshotLabelFromFilename(fileName: string): string | null {
  const match = fileName.match(/(\d{6})/);
  return match?.[1] ?? null;
}

export function formatUploadDateAsSnapshot(uploadDate = new Date()): {
  snapshot_date: string;
  snapshot_label: string;
} {
  const year = uploadDate.getFullYear();
  const month = String(uploadDate.getMonth() + 1).padStart(2, "0");
  const day = String(uploadDate.getDate()).padStart(2, "0");
  return {
    snapshot_date: `${year}-${month}-${day}`,
    snapshot_label: `${String(year).slice(2)}${month}${day}`
  };
}

/** 파일명(260703) → 시트 라벨 → 업로드일 순으로 기준일 결정 */
export function resolvePipelineSnapshotDate(
  sourceFileName: string,
  options?: { sheetLabel?: string | null; uploadDate?: Date }
): { snapshot_date: string; snapshot_label: string; source: "sheet" | "filename" | "upload_date" } {
  const uploadDate = options?.uploadDate ?? new Date();
  const sheetLabel = options?.sheetLabel?.trim() || null;

  if (sheetLabel) {
    const fromSheet = parseSnapshotLabelToDate(sheetLabel);
    if (fromSheet) {
      return { snapshot_date: fromSheet, snapshot_label: sheetLabel, source: "sheet" };
    }
  }

  const fromFileLabel = extractSnapshotLabelFromFilename(sourceFileName);
  if (fromFileLabel) {
    const fromFile = parseSnapshotLabelToDate(fromFileLabel);
    if (fromFile) {
      return { snapshot_date: fromFile, snapshot_label: fromFileLabel, source: "filename" };
    }
  }

  const fallback = formatUploadDateAsSnapshot(uploadDate);
  return { ...fallback, source: "upload_date" };
}
