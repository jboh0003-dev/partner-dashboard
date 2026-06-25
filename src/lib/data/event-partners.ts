import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PARTNER_EVENT_COLUMNS } from "@/lib/events/event-display";
import type {
  EventPartnerLinkRecord,
  EventPartnerLinkWithPartner,
  PartnerLinkedEventItem
} from "@/lib/events/event-partner-types";
export {
  EVENT_PARTNER_RELATION_TYPES,
  type EventPartnerRelationType,
  type EventPartnerLinkRecord,
  type EventPartnerLinkWithPartner,
  type PartnerLinkedEventItem
} from "@/lib/events/event-partner-types";
import { filterSamplePartners } from "@/lib/partners/sample-filter";
import type { Partner } from "@/types/partner";

export async function fetchEventPartnerLinks(
  eventId: string
): Promise<{ links: EventPartnerLinkWithPartner[]; error: string | null }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("partner_event_partners")
    .select("*, partner:partners (id, company_name, grade)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.includes("partner_event_partners")) {
      return { links: [], error: null };
    }
    return { links: [], error: error.message };
  }

  const links = (data ?? []).map((row) => {
    const partnerRaw = row.partner as
      | Pick<Partner, "id" | "company_name" | "grade">
      | Array<Pick<Partner, "id" | "company_name" | "grade">>
      | null;
    const partner = Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw;
    const { partner: _partner, ...link } = row;
    return {
      ...(link as EventPartnerLinkRecord),
      partner: partner ?? { id: row.partner_id, company_name: "(미상)", grade: null }
    };
  });

  return { links, error: null };
}

export async function fetchPartnerLinkedEvents(
  partnerId: string
): Promise<{ events: PartnerLinkedEventItem[]; error: string | null }> {
  const supabase = await createClient();

  const { data: linkRows, error: linkError } = await supabase
    .from("partner_event_partners")
    .select("id, event_id, relation_type, source")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  if (linkError) {
    if (linkError.message.includes("partner_event_partners")) {
      return { events: [], error: null };
    }
    return { events: [], error: linkError.message };
  }

  const links = linkRows ?? [];
  if (links.length === 0) {
    return { events: [], error: null };
  }

  const eventIds = links.map((link) => link.event_id);

  const [{ data: eventsData, error: eventsError }, { data: docsData, error: docsError }] =
    await Promise.all([
      supabase.from("partner_events").select(PARTNER_EVENT_COLUMNS).in("id", eventIds),
      supabase.from("partner_event_documents").select("event_id").in("event_id", eventIds)
    ]);

  if (eventsError) return { events: [], error: eventsError.message };
  if (docsError) return { events: [], error: docsError.message };

  const eventMap = new Map((eventsData ?? []).map((event) => [event.id as string, event]));
  const docCounts = new Map<string, number>();
  for (const doc of docsData ?? []) {
    const eventId = doc.event_id as string;
    docCounts.set(eventId, (docCounts.get(eventId) ?? 0) + 1);
  }

  const events: PartnerLinkedEventItem[] = links
    .map((link) => {
      const event = eventMap.get(link.event_id);
      if (!event) return null;
      return {
        id: link.id as string,
        event_id: link.event_id as string,
        event_name: event.event_name as string,
        event_type: (event.event_type as string | null) ?? null,
        event_date: (event.event_date as string | null) ?? null,
        location: (event.location as string | null) ?? null,
        relation_type: link.relation_type as string,
        source: link.source as string,
        document_count: docCounts.get(link.event_id as string) ?? 0
      };
    })
    .filter((item): item is PartnerLinkedEventItem => item != null);

  return { events, error: null };
}

export async function searchPartnersForEventLink(
  query: string,
  limit = 20
): Promise<Array<Pick<Partner, "id" | "company_name" | "grade">>> {
  const supabase = await createClient();
  const q = query.trim();

  let request = supabase
    .from("partners")
    .select("id, company_name, grade")
    .order("company_name", { ascending: true })
    .limit(limit);

  if (q) {
    request = request.ilike("company_name", `%${q}%`);
  }

  const { data } = await request;
  return filterSamplePartners((data ?? []) as Partner[]).map((partner) => ({
    id: partner.id,
    company_name: partner.company_name,
    grade: partner.grade
  }));
}

export async function createEventPartnerLink(input: {
  eventId: string;
  partnerId: string;
  relationType: string;
  note?: string | null;
}): Promise<{ link: EventPartnerLinkRecord | null; error: string | null }> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("partner_event_partners")
    .insert({
      event_id: input.eventId,
      partner_id: input.partnerId,
      relation_type: input.relationType,
      source: "manual",
      note: input.note ?? null
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { link: null, error: "이미 연결된 파트너입니다." };
    }
    return { link: null, error: error.message };
  }

  return { link: data as EventPartnerLinkRecord, error: null };
}

export async function deleteEventPartnerLink(
  linkId: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("partner_event_partners").delete().eq("id", linkId);
  return { error: error?.message ?? null };
}
