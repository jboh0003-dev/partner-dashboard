import { parseEventFolderName } from "@/lib/events/folder-parser";

/** 업로드 루트 래퍼 폴더 — 행사명으로 사용하지 않음 */
const WRAPPER_FOLDER_PATTERNS: RegExp[] = [
  /^_?행사[_\s-]*업로드[_\s-]*1차[_\s-]*선별$/i,
  /^_?행사[_\s-]*업로드[_\s-]*최소팩$/i,
  /^_?행사[_\s-]*업로드$/i,
  /^행사[_\s-]*업로드$/i,
  /^업로드$/i,
  /^선별$/i,
  /^1차[_\s-]*선별$/i
];

const YEAR_FOLDER_PATTERN = /^(\d{4})년$/;

export type ResolvedEventPath = {
  eventFolderName: string;
  yearFromPath: number | null;
};

export function isWrapperFolderName(name: string): boolean {
  const trimmed = name.trim();
  return WRAPPER_FOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isYearFolderName(name: string): boolean {
  return YEAR_FOLDER_PATTERN.test(name.trim());
}

export function extractYearFromFolderName(name: string): number | null {
  const match = name.trim().match(YEAR_FOLDER_PATTERN);
  return match ? Number(match[1]) : null;
}

/**
 * source_path(webkitRelativePath)에서 실제 행사 폴더명 추출.
 * 예: _행사_업로드_최소팩/2026년/파트너데이 (26.03.18)/file.pdf
 *   → eventFolderName = "파트너데이 (26.03.18)", yearFromPath = 2026
 */
export function resolveEventFolderFromSourcePath(sourcePath: string): ResolvedEventPath {
  const parts = sourcePath.replace(/\\/g, "/").split("/").filter(Boolean);

  if (parts.length <= 1) {
    return { eventFolderName: parts[0] ?? "미분류", yearFromPath: null };
  }

  const folderParts = parts.slice(0, -1);
  let yearFromPath: number | null = null;
  const candidates: string[] = [];

  for (const part of folderParts) {
    if (isWrapperFolderName(part)) continue;

    const year = extractYearFromFolderName(part);
    if (year != null) {
      yearFromPath = year;
      continue;
    }

    candidates.push(part);
  }

  const parsedCandidate = candidates.find((candidate) => parseEventFolderName(candidate) != null);
  const eventFolderName =
    parsedCandidate ?? candidates[candidates.length - 1] ?? folderParts[folderParts.length - 1] ?? "미분류";

  return { eventFolderName, yearFromPath };
}

export type ResolvedEventContext = {
  eventFolderName: string;
  eventName: string;
  eventType: string;
  eventDate: string | null;
  eventYear: number | null;
};

/** source_path 기준 행사 마스터 생성에 쓸 메타데이터 */
export function resolveEventContextFromSourcePath(
  sourcePath: string,
  fallback?: Partial<ResolvedEventContext>
): ResolvedEventContext {
  const { eventFolderName, yearFromPath } = resolveEventFolderFromSourcePath(sourcePath);
  const parsed = parseEventFolderName(eventFolderName);

  return {
    eventFolderName,
    eventName: parsed?.eventName ?? fallback?.eventName ?? eventFolderName,
    eventType: parsed?.eventType ?? fallback?.eventType ?? "기타",
    eventDate: parsed?.eventDate ?? fallback?.eventDate ?? null,
    eventYear: parsed?.year ?? yearFromPath ?? fallback?.eventYear ?? null
  };
}
