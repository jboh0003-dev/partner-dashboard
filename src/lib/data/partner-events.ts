import { createClient } from "@/lib/supabase/server";
import {
  aggregateEventDocumentCounts,
  filterDisplayablePartnerEvents,
  eventTypeIncludes,
  groupDocumentsByEventId,
  PARTNER_EVENT_COLUMNS,
  sortEventDocumentsByUploadedAt
} from "@/lib/events/event-display";
import type { PartnerEventDocument, PartnerEventRecord, PartnerEventWithDocs } from "@/types/event";

export type EventListFilters = {
  q?: string;
  type?: string;
  year?: string;
};

export type EventSummaryStats = {
  totalEvents: number;
  thisYearEvents: number;
  partnerDayCount: number;
  seminarCount: number;
  roundtableCount: number;
};

export type PartnerEventsFetchDebug = {
  fetchedEventsRaw: number;
  fetchedEventsDisplay: number;
  fetchedDocuments: number;
  eventsError: string | null;
  documentsError: string | null;
};

export type PartnerEventsFetchResult = {
  events: PartnerEventWithDocs[];
  error: string | null;
  documentsError: string | null;
  debug: PartnerEventsFetchDebug;
};

function mapEventWithDocs(
  event: PartnerEventRecord,
  allDocs: PartnerEventDocument[]
): PartnerEventWithDocs {
  const sortedDocs = sortEventDocumentsByUploadedAt(allDocs);
  const counts = aggregateEventDocumentCounts(sortedDocs);

  return {
    ...event,
    documents: sortedDocs,
    all_documents: sortedDocs,
    document_count: counts.document_count,
    public_document_count: counts.document_count,
    all_document_count: counts.document_count,
    representative_document_count: counts.representative_document_count,
    presentation_document_count: counts.presentation_document_count,
    photo_document_count: counts.photo_document_count,
    attendance_document_count: counts.attendance_document_count,
    normal_document_count: Math.max(0, counts.document_count - counts.representative_document_count),
    internal_document_count: 0
  };
}

function applyClientFilters(
  events: PartnerEventRecord[],
  filters: EventListFilters
): PartnerEventRecord[] {
  let result = [...events];

  if (filters.type && filters.type !== "all") {
    result = result.filter((event) => event.event_type === filters.type);
  }

  if (filters.year && filters.year !== "all") {
    const yearNum = Number(filters.year);
    if (Number.isFinite(yearNum)) {
      result = result.filter((event) => event.year === yearNum);
    }
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    result = result.filter((event) => {
      const haystack = [
        event.event_name,
        event.event_type,
        event.summary,
        event.location,
        event.description,
        event.related_partners,
        event.source_folder_name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return result.sort((left, right) => {
    const leftDate = left.event_date ? new Date(left.event_date).getTime() : 0;
    const rightDate = right.event_date ? new Date(right.event_date).getTime() : 0;
    if (leftDate !== rightDate) return rightDate - leftDate;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
}

export async function fetchPartnerEvents(
  filters: EventListFilters = {}
): Promise<PartnerEventsFetchResult> {
  const debug: PartnerEventsFetchDebug = {
    fetchedEventsRaw: 0,
    fetchedEventsDisplay: 0,
    fetchedDocuments: 0,
    eventsError: null,
    documentsError: null
  };

  const supabase = await createClient();

  const { data: eventsData, error: eventsError } = await supabase
    .from("partner_events")
    .select(PARTNER_EVENT_COLUMNS);

  if (eventsError) {
    debug.eventsError = eventsError.message;
    console.error("[fetchPartnerEvents] partner_events 조회 실패:", eventsError.message, eventsError);
    return { events: [], error: eventsError.message, documentsError: null, debug };
  }

  const rawEvents = (eventsData ?? []) as PartnerEventRecord[];
  debug.fetchedEventsRaw = rawEvents.length;

  const { data: docsData, error: documentsError } = await supabase
    .from("partner_event_documents")
    .select("*");

  if (documentsError) {
    debug.documentsError = documentsError.message;
    console.error(
      "[fetchPartnerEvents] partner_event_documents 조회 실패:",
      documentsError.message,
      documentsError
    );
  }

  const allDocuments = (documentsError ? [] : (docsData ?? [])) as PartnerEventDocument[];
  debug.fetchedDocuments = allDocuments.length;

  const docsByEvent = groupDocumentsByEventId(allDocuments);

  const displayableEvents = filterDisplayablePartnerEvents(rawEvents);
  const filteredEvents = applyClientFilters(displayableEvents, filters);
  debug.fetchedEventsDisplay = filteredEvents.length;

  console.log("[fetchPartnerEvents] debug:", {
    fetchedEventsRaw: debug.fetchedEventsRaw,
    fetchedEventsDisplay: debug.fetchedEventsDisplay,
    fetchedDocuments: debug.fetchedDocuments,
    eventsError: debug.eventsError,
    documentsError: debug.documentsError
  });

  return {
    events: filteredEvents.map((event) =>
      mapEventWithDocs(event, docsByEvent.get(event.id) ?? [])
    ),
    error: null,
    documentsError: documentsError?.message ?? null,
    debug
  };
}

export async function fetchPartnerEventById(
  id: string
): Promise<{ event: PartnerEventWithDocs | null; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("partner_events")
    .select(PARTNER_EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[fetchPartnerEventById] partner_events 조회 실패:", error.message, error);
    return { event: null, error: error.message };
  }
  if (!data) return { event: null, error: null };

  const event = data as PartnerEventRecord;

  const { data: docsData, error: docsError } = await supabase
    .from("partner_event_documents")
    .select("*")
    .eq("event_id", id);

  if (docsError) {
    console.error(
      "[fetchPartnerEventById] partner_event_documents 조회 실패:",
      docsError.message,
      docsError
    );
    return { event: null, error: docsError.message };
  }

  const allDocs = (docsData ?? []) as PartnerEventDocument[];

  return {
    event: mapEventWithDocs(event, allDocs),
    error: null
  };
}

export function computeEventSummaryStats(events: PartnerEventWithDocs[]): EventSummaryStats {
  const currentYear = new Date().getFullYear();
  return {
    totalEvents: events.length,
    thisYearEvents: events.filter((event) => event.year === currentYear).length,
    partnerDayCount: events.filter((event) => eventTypeIncludes(event.event_type, "파트너데이"))
      .length,
    seminarCount: events.filter((event) => eventTypeIncludes(event.event_type, "세미나")).length,
    roundtableCount: events.filter((event) => eventTypeIncludes(event.event_type, "간담회")).length
  };
}

export function uniqueEventYears(events: PartnerEventWithDocs[]): number[] {
  const years = new Set<number>();
  for (const event of events) {
    if (event.year) years.add(event.year);
    else if (event.event_date) {
      const y = new Date(event.event_date).getFullYear();
      if (Number.isFinite(y)) years.add(y);
    }
  }
  return Array.from(years).sort((a, b) => b - a);
}
