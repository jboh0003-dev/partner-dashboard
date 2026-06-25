import type { PartnerEventDocument, PartnerEventRecord } from "@/types/event";
import {
  filterDisplayablePartnerEvents,
  sortEventDocumentsByUploadedAt
} from "@/lib/events/event-display";

export type EventSearchHit = PartnerEventRecord & {
  score: number;
  documents: PartnerEventDocument[];
  allDocumentCount: number;
};

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function parseEventYear(query: string): number | null {
  const full = query.match(/(20\d{2})\s*년/);
  if (full) return Number(full[1]);
  const short = query.match(/(?:^|\s)(\d{2})\s*년/);
  if (short) return 2000 + Number(short[1]);
  return null;
}

function documentSearchScore(doc: PartnerEventDocument, tokens: string[]): number {
  let score = 0;
  if (doc.is_representative) score += 80;
  const haystack = [doc.display_name, doc.original_file_name, doc.document_type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const token of tokens) {
    if (haystack.includes(token)) score += 15;
  }
  return score;
}

export function searchPartnerEvents(
  query: string,
  events: PartnerEventRecord[],
  documents: PartnerEventDocument[],
  limit = 8
): EventSearchHit[] {
  const haystack = query.toLowerCase().replace(/\s+/g, "");
  const tokens = tokenize(query);
  const yearFilter = parseEventYear(query);
  const displayEvents = filterDisplayablePartnerEvents(events);
  const docsByEvent = new Map<string, PartnerEventDocument[]>();

  for (const doc of documents) {
    if (!doc.event_id) continue;
    const list = docsByEvent.get(doc.event_id) ?? [];
    list.push(doc);
    docsByEvent.set(doc.event_id, list);
  }

  const scored = displayEvents
    .map((event) => {
      let score = 0;
      const name = event.event_name.toLowerCase().replace(/\s+/g, "");
      const type = (event.event_type ?? "").toLowerCase();
      const folder = (event.source_folder_name ?? "").toLowerCase();
      const summary = (event.summary ?? "").toLowerCase();

      if (yearFilter && event.year === yearFilter) score += 60;
      if (yearFilter && event.event_date?.startsWith(String(yearFilter))) score += 40;

      if (name && haystack.includes(name)) score += 120;
      if (folder && haystack.includes(folder.replace(/\s+/g, ""))) score += 100;

      for (const token of tokens) {
        if (name.includes(token.replace(/\s+/g, ""))) score += 40;
        if (type.includes(token)) score += 35;
        if (folder.includes(token)) score += 30;
        if (summary.includes(token)) score += 25;
      }

      if (/파트너데이|파트너day/.test(haystack) && type.includes("파트너데이")) score += 50;
      if (/세미나/.test(haystack) && type.includes("세미나")) score += 50;
      if (/간담회/.test(haystack) && type.includes("간담회")) score += 50;
      if (/솔루션데이/.test(haystack) && type.includes("솔루션데이")) score += 50;
      if (/정책설명회|킥오프/.test(haystack) && type.includes("정책설명회")) score += 50;
      if (/행사\s*목록|년.*행사/.test(query.replace(/\s+/g, "")) && yearFilter) score += 30;

      const allEventDocs = docsByEvent.get(event.id) ?? [];
      const sortedDocs = sortEventDocumentsByUploadedAt(allEventDocs);
      const topDocScore = sortedDocs.reduce(
        (max, doc) => Math.max(max, documentSearchScore(doc, tokens)),
        0
      );
      score += topDocScore;

      return {
        ...event,
        score,
        documents: sortedDocs,
        allDocumentCount: allEventDocs.length
      };
    })
    .filter((event) => event.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}

export function parseEventYearFromQuery(query: string): number | null {
  return parseEventYear(query);
}

export function wantsEventAllFiles(query: string): boolean {
  return /전체\s*파일|모든\s*파일|전부\s*보여|all\s*files/i.test(query);
}
