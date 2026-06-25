import { parseEventFolderName } from "@/lib/events/folder-parser";
import { classifyEventFile, type EventFileInput } from "@/lib/events/event-file-classifier";
import { resolveEventContextFromSourcePath } from "@/lib/events/event-source-path";
import { applyEventVersionSelection, type EventCurationRow } from "@/lib/events/event-version-picker";
import { defaultUploadSelected, rowIsOversized } from "@/lib/events/event-upload-limits";
import type { EventFileStatus } from "@/lib/events/event-document-types";

export type ScannedEventFile = EventFileInput & {
  eventFolderName?: string;
};

export type EventCurationScanSummary = {
  totalFiles: number;
  eventFolderCount: number;
  representative: number;
  normal: number;
  internal: number;
  draft: number;
  oldVersion: number;
  duplicate: number;
  excluded: number;
  oversized: number;
};

export function scanEventFiles(files: ScannedEventFile[]): {
  rows: EventCurationRow[];
  summary: EventCurationScanSummary;
} {
  const rawRows: EventCurationRow[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    const context = resolveEventContextFromSourcePath(file.sourcePath, {
      eventName: file.eventFolderName
    });
    const classified = classifyEventFile(file);

    rawRows.push({
      ...classified,
      rowId: `scan-${index}-${classified.originalFilename}`,
      eventFolderName: context.eventFolderName,
      eventName: context.eventName,
      eventType: context.eventType,
      eventDate: context.eventDate,
      eventYear: context.eventYear,
      isRepresentative: false
    });
  }

  const rows = applyEventVersionSelection(rawRows).map((row) => ({
    ...row,
    uploadSelected: defaultUploadSelected(row)
  }));
  const summary: EventCurationScanSummary = {
    totalFiles: rows.length,
    eventFolderCount: new Set(rows.map((row) => row.eventFolderName)).size,
    representative: rows.filter((row) => row.fileStatus === "representative").length,
    normal: rows.filter((row) => row.fileStatus === "normal").length,
    internal: rows.filter((row) => row.fileStatus === "internal").length,
    draft: rows.filter((row) => row.fileStatus === "draft").length,
    oldVersion: rows.filter((row) => row.fileStatus === "old_version").length,
    duplicate: rows.filter((row) => row.fileStatus === "duplicate").length,
    excluded: rows.filter((row) => row.fileStatus === "excluded" && !rowIsOversized(row)).length,
    oversized: rows.filter((row) => rowIsOversized(row)).length
  };

  return { rows, summary };
}

export type EventCurationFilter =
  | "all"
  | EventFileStatus;

export function filterCurationRows<T extends {
  fileStatus: EventFileStatus;
  eventFolderName: string;
  documentType: string;
}>(
  rows: T[],
  filters: {
    status?: EventCurationFilter;
    eventFolder?: string;
    documentType?: string;
  }
): T[] {
  return rows.filter((row) => {
    if (filters.status && filters.status !== "all" && row.fileStatus !== filters.status) {
      return false;
    }
    if (filters.eventFolder && filters.eventFolder !== "all" && row.eventFolderName !== filters.eventFolder) {
      return false;
    }
    if (filters.documentType && filters.documentType !== "all" && row.documentType !== filters.documentType) {
      return false;
    }
    return true;
  });
}

export function countByFileStatus(rows: EventCurationRow[], status: EventFileStatus): number {
  return rows.filter((row) => row.fileStatus === status).length;
}
