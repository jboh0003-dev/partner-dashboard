import type { ClassifiedEventFile } from "@/lib/events/event-file-classifier";
import type { EventFileStatus } from "@/lib/events/event-document-types";
import {
  MAX_REPRESENTATIVE_PHOTOS_PER_EVENT,
  type EventDocumentType
} from "@/lib/events/event-document-types";

export type EventCurationRow = ClassifiedEventFile & {
  rowId: string;
  eventFolderName: string;
  eventName: string;
  eventType: string;
  eventDate: string | null;
  eventYear: number | null;
  isRepresentative: boolean;
};

function groupKey(row: Pick<EventCurationRow, "eventFolderName" | "documentType">): string {
  return `${row.eventFolderName}::${row.documentType}`;
}

const VERSION_COMPETE_STATUSES: EventFileStatus[] = ["normal", "representative"];

/** 동일 행사·유형 내 대표 자료 선정 및 사진 수 제한 */
export function applyEventVersionSelection(rows: EventCurationRow[]): EventCurationRow[] {
  const byGroup = new Map<string, EventCurationRow[]>();

  for (const row of rows) {
    if (!VERSION_COMPETE_STATUSES.includes(row.fileStatus) && row.fileStatus !== "draft") {
      continue;
    }
    const key = groupKey(row);
    const bucket = byGroup.get(key) ?? [];
    bucket.push(row);
    byGroup.set(key, bucket);
  }

  const representativeIds = new Set<string>();

  for (const bucket of byGroup.values()) {
    const candidates = bucket
      .filter((row) => VERSION_COMPETE_STATUSES.includes(row.fileStatus) || row.fileStatus === "draft")
      .sort((a, b) => b.qualityScore - a.qualityScore);

    if (candidates.length === 0) continue;

    const winner = candidates[0]!;
    representativeIds.add(winner.rowId);

    for (const loser of candidates.slice(1)) {
      if (VERSION_COMPETE_STATUSES.includes(loser.fileStatus) || loser.fileStatus === "draft") {
        loser.fileStatus = "old_version";
        loser.excludeReason = loser.excludeReason ?? "동일 유형 대표 자료 선정에 따른 구버전";
        loser.isRepresentative = false;
      }
    }
  }

  const photoRows = rows
    .filter((row) => row.documentType === "photo" && row.fileStatus !== "excluded")
    .sort((a, b) => b.qualityScore - a.qualityScore);

  const photoWinners = new Set(
    photoRows.slice(0, MAX_REPRESENTATIVE_PHOTOS_PER_EVENT).map((row) => row.rowId)
  );

  return rows.map((row) => {
    let fileStatus = row.fileStatus;
    let excludeReason = row.excludeReason;
    let isRepresentative = representativeIds.has(row.rowId);

    if (row.documentType === "photo" && row.fileStatus !== "excluded" && row.fileStatus !== "internal") {
      if (photoWinners.has(row.rowId)) {
        isRepresentative = true;
        fileStatus = "representative";
      } else {
        fileStatus = "excluded";
        excludeReason = excludeReason ?? "대표 사진 선별 제외 (행사당 최대 5장)";
        isRepresentative = false;
      }
    } else if (isRepresentative && fileStatus === "normal") {
      fileStatus = "representative";
    }

    return {
      ...row,
      fileStatus,
      excludeReason,
      isRepresentative: isRepresentative && fileStatus === "representative"
    };
  });
}

export function documentTypeRank(type: EventDocumentType): number {
  const order: EventDocumentType[] = [
    "presentation",
    "result_report",
    "invitation",
    "attendance",
    "policy",
    "photo",
    "other",
    "internal_prep",
    "archive"
  ];
  const index = order.indexOf(type);
  return index >= 0 ? index : 99;
}
