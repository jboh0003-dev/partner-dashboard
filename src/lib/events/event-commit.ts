import type { SupabaseClient } from "@supabase/supabase-js";
import { parseEventFolderName } from "@/lib/events/folder-parser";
import { buildEventDescription, buildEventSummary } from "@/lib/events/event-description";
import { resolveEventContextFromSourcePath } from "@/lib/events/event-source-path";
import type { EventTypeLabel } from "@/lib/events/event-types";
import type { EventCurationReviewRow } from "@/types/event";

export function enrichEventRowFromSourcePath(row: EventCurationReviewRow): EventCurationReviewRow {
  const context = resolveEventContextFromSourcePath(row.sourcePath, {
    eventFolderName: row.eventFolderName,
    eventName: row.eventName,
    eventType: row.eventType,
    eventDate: row.eventDate,
    eventYear: row.eventYear
  });

  return {
    ...row,
    eventFolderName: context.eventFolderName,
    eventName: context.eventName,
    eventType: context.eventType,
    eventDate: context.eventDate,
    eventYear: context.eventYear
  };
}

export async function findExistingPartnerEventId(
  supabase: SupabaseClient,
  row: EventCurationReviewRow
): Promise<string | null> {
  const parsed = parseEventFolderName(row.eventFolderName);

  const { data: byFolder } = await supabase
    .from("partner_events")
    .select("id")
    .eq("source_folder_name", row.eventFolderName)
    .maybeSingle();

  if (byFolder?.id) return byFolder.id as string;

  const eventName = parsed?.eventName ?? row.eventName;
  const year = parsed?.year ?? row.eventYear;

  if (eventName && year) {
    const { data: byNameYear } = await supabase
      .from("partner_events")
      .select("id")
      .eq("event_name", eventName)
      .eq("year", year)
      .maybeSingle();

    if (byNameYear?.id) return byNameYear.id as string;
  }

  if (parsed?.eventDate) {
    const { data: byDate } = await supabase
      .from("partner_events")
      .select("id")
      .eq("event_name", eventName)
      .eq("event_date_start", parsed.eventDate)
      .maybeSingle();

    if (byDate?.id) return byDate.id as string;
  }

  return null;
}

export async function createPartnerEventMaster(
  supabase: SupabaseClient,
  row: EventCurationReviewRow
): Promise<{ id: string } | { error: string }> {
  const parsed = parseEventFolderName(row.eventFolderName);
  const eventType = parsed?.eventType ?? row.eventType;
  const eventDate = parsed?.eventDate ?? row.eventDate;
  const eventName = parsed?.eventName ?? row.eventName;
  const year = parsed?.year ?? row.eventYear;

  const { data: inserted, error } = await supabase
    .from("partner_events")
    .insert({
      year,
      event_name: eventName,
      event_type: eventType,
      event_date: eventDate,
      event_date_start: eventDate,
      description: parsed ? buildEventDescription(parsed.eventType as EventTypeLabel) : null,
      summary: eventDate ? buildEventSummary(eventName, eventDate) : eventName,
      source_folder_name: row.eventFolderName,
      visibility: "internal_all"
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return { error: error?.message ?? "행사 마스터 생성 실패" };
  }

  return { id: inserted.id as string };
}

export type ResolvedPartnerEvent = {
  eventId: string;
  created: boolean;
  existedBefore: boolean;
};

export type PartnerEventCache = Map<string, ResolvedPartnerEvent>;

export async function resolvePartnerEventId(
  supabase: SupabaseClient,
  row: EventCurationReviewRow,
  cache: PartnerEventCache,
  targetEventId?: string | null
): Promise<ResolvedPartnerEvent | { error: string }> {
  const folderKey = row.eventFolderName;

  if (targetEventId) {
    const resolved = { eventId: targetEventId, created: false, existedBefore: true };
    cache.set(folderKey, resolved);
    return resolved;
  }

  const cached = cache.get(folderKey);
  if (cached) {
    return cached;
  }

  const existingId = await findExistingPartnerEventId(supabase, row);
  if (existingId) {
    const resolved = { eventId: existingId, created: false, existedBefore: true };
    cache.set(folderKey, resolved);
    return resolved;
  }

  const created = await createPartnerEventMaster(supabase, row);
  if ("error" in created) {
    return { error: created.error };
  }

  const resolved = { eventId: created.id, created: true, existedBefore: false };
  cache.set(folderKey, resolved);
  return resolved;
}
