import { EVENT_TYPE_LABELS, type EventTypeLabel } from "@/lib/events/event-types";
import { buildEventDescription } from "@/lib/events/event-description";

export type ParsedEventFolder = {
  eventName: string;
  eventType: EventTypeLabel;
  eventDate: string | null;
  year: number | null;
  sourceFolderName: string;
  description: string;
};

/** YYMMDD → 20YY-MM-DD */
function parseCompactDate(value: string): string | null {
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** YY.MM.DD → 20YY-MM-DD */
function parseDotDate(value: string): string | null {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!match) return null;
  const year = 2000 + Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function classifyEventType(eventName: string, folderName: string): EventTypeLabel {
  const haystack = `${eventName} ${folderName}`.toLowerCase().replace(/\s+/g, "");

  if (/파트너데이|파트너day/.test(haystack)) return "파트너데이";
  if (/솔루션데이|solutionday/.test(haystack)) return "솔루션데이";
  if (/세미나|seminar/.test(haystack)) return "세미나";
  if (/간담회/.test(haystack)) return "간담회";
  if (/킥오프|정책설명회/.test(haystack)) return "정책설명회";
  return "기타";
}

function stripDateSuffix(name: string): string {
  return name
    .replace(/\s*\(\d{6}\)\s*$/, "")
    .replace(/\s*\(\d{2}\.\d{2}\.\d{2}\)\s*$/, "")
    .trim();
}

/**
 * 폴더명에서 행사 정보 추출
 * 예: "파트너 데이_w티맥스 (241128)", "부산세미나 (26.04.23)"
 */
export function parseEventFolderName(folderName: string): ParsedEventFolder | null {
  const trimmed = folderName.trim();
  if (!trimmed) return null;

  let eventDate: string | null = null;
  const compactMatch = trimmed.match(/\((\d{6})\)\s*$/);
  const dotMatch = trimmed.match(/\((\d{2}\.\d{2}\.\d{2})\)\s*$/);

  if (compactMatch) {
    eventDate = parseCompactDate(compactMatch[1]);
  } else if (dotMatch) {
    eventDate = parseDotDate(dotMatch[1]);
  }

  const eventName = stripDateSuffix(trimmed);
  if (!eventName) return null;

  const eventType = classifyEventType(eventName, trimmed);
  const year = eventDate ? new Date(eventDate).getFullYear() : null;

  return {
    eventName,
    eventType,
    eventDate,
    year,
    sourceFolderName: trimmed,
    description: buildEventDescription(eventType)
  };
}

export function formatEventTypeLabel(type: string | null | undefined): string {
  if (!type) return "-";
  return EVENT_TYPE_LABELS[type as EventTypeLabel] ?? type;
}
