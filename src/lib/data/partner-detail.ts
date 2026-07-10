import { preparePartnerDetailAssets } from "@/lib/assets/partner-detail-assets";
import { fetchPartnerPerformanceBundle } from "@/lib/data/partner-performance";
import { createClient } from "@/lib/supabase/server";
import { isSamplePartner } from "@/lib/partners/sample-filter";
import type { PartnerAsset } from "@/types/asset";
import type { PartnerDocument } from "@/types/document";
import type { PartnerPoc } from "@/types/poc";
import type {
  Partner,
  PartnerContact,
  PartnerNote,
  PartnerTrainingMonthly
} from "@/types/partner";
import type {
  PartnerDetailBundle,
  PartnerEventHistoryItem,
  PartnerTrainingHistoryItem,
  PartnerTrainingSessionGroup
} from "@/types/partner-detail";
import type { Training, TrainingAttendance } from "@/types/training";
import type { PartnerEvent, EventAttendance } from "@/types/event";
import { fetchPartnerLinkedEvents } from "@/lib/data/event-partners";

type TrainingAttendanceJoined = Pick<
  TrainingAttendance,
  | "id"
  | "training_id"
  | "attendee_name"
  | "attendee_department"
  | "attendee_position"
  | "attended"
  | "score"
  | "converted_score"
  | "rank"
  | "exam_status"
  | "attendance_days"
  | "partial_days"
  | "absent_days"
  | "evaluation_result"
  | "extra_json"
> & {
  training:
    | Pick<
        Training,
        | "training_name"
        | "training_type"
        | "product_name"
        | "start_date"
        | "end_date"
        | "description"
        | "metadata"
      >
    | Array<
        Pick<
          Training,
          | "training_name"
          | "training_type"
          | "product_name"
          | "start_date"
          | "end_date"
          | "description"
          | "metadata"
        >
      >
    | null;
};

type EventAttendanceJoined = Pick<
  EventAttendance,
  "id" | "event_id" | "attendee_name" | "attendee_department" | "attendee_position" | "attended"
> & {
  event:
    | Pick<PartnerEvent, "event_name" | "event_type" | "event_date" | "location">
    | Array<Pick<PartnerEvent, "event_name" | "event_type" | "event_date" | "location">>
    | null;
};

/**
 * 파트너 상세 페이지 / 향후 AI 에이전트가 사용할 통합 조회.
 * UI 컴포넌트는 이 함수만 호출하고 Supabase 쿼리를 직접 작성하지 않는다.
 */
export async function fetchPartnerDetailBundle(
  partnerId: string
): Promise<PartnerDetailBundle | null> {
  const supabase = await createClient();

  const [
    { data: partner },
    { data: contacts },
    { data: notes },
    { data: trainingRows },
    { data: eventRows },
    { data: pocRows },
    { data: assetRows },
    { data: documentRows },
    { data: monthlyRows },
    linkedEventsResult,
    performanceBundle
  ] = await Promise.all([
    supabase.from("partners").select("*").eq("id", partnerId).single(),
    supabase
      .from("partner_contacts")
      .select("*")
      .eq("partner_id", partnerId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("partner_notes")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_attendance")
      .select(
        "id, training_id, attendee_name, attendee_department, attendee_position, attended, score, converted_score, rank, exam_status, attendance_days, partial_days, absent_days, evaluation_result, extra_json, training:trainings (training_name, training_type, product_name, start_date, end_date, description, metadata)"
      )
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("event_attendance")
      .select(
        "id, event_id, attendee_name, attendee_department, attendee_position, attended, event:events (event_name, event_type, event_date, location)"
      )
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_pocs")
      .select("*")
      .eq("partner_id", partnerId)
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("partner_assets")
      .select("*")
      .eq("partner_id", partnerId)
      .order("node_name", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_documents")
      .select("*")
      .eq("partner_id", partnerId)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_training_monthly")
      .select("*")
      .eq("partner_id", partnerId)
      .order("training_year", { ascending: false })
      .order("training_month", { ascending: false }),
    fetchPartnerLinkedEvents(partnerId),
    fetchPartnerPerformanceBundle(partnerId)
  ]);

  if (!partner || isSamplePartner(partner as Partner)) return null;

  const linkedEvents = linkedEventsResult.events;
  const attendanceEvents = flattenEventHistory(
    (eventRows ?? []) as unknown as EventAttendanceJoined[]
  );
  const linkedEventIds = new Set(linkedEvents.map((event) => event.event_id));
  const mergedEvents: PartnerEventHistoryItem[] = [
    ...linkedEvents.map((event) => ({
      id: event.id,
      event_id: event.event_id,
      event_name: event.event_name,
      event_type: event.event_type,
      event_date: event.event_date,
      location: event.location,
      relation_type: event.relation_type,
      document_count: event.document_count,
      source: "manual" as const
    })),
    ...attendanceEvents
      .filter((event) => !linkedEventIds.has(event.event_id))
      .map((event) => ({
        ...event,
        relation_type: event.attended ? "참석" : "관련",
        document_count: 0,
        source: "attendance" as const
      }))
  ];

  const trainings = flattenTrainingHistory(
    (trainingRows ?? []) as unknown as TrainingAttendanceJoined[]
  );

  return {
    partner: partner as Partner,
    contacts: ((contacts ?? []) as PartnerContact[]).filter(
      (contact) =>
        contact.is_active !== false &&
        contact.in_current_full_db !== false &&
        !contact.deleted_at
    ),
    inactiveContacts: ((contacts ?? []) as PartnerContact[]).filter(
      (contact) =>
        (contact.is_active === false || contact.in_current_full_db === false) &&
        !contact.deleted_at
    ),
    notes: (notes ?? []) as PartnerNote[],
    trainings,
    trainingSessions: groupTrainingSessions(trainings),
    monthlyTrainings: (monthlyRows ?? []) as PartnerTrainingMonthly[],
    events: mergedEvents,
    pocs: (pocRows ?? []) as PartnerPoc[],
    assets: preparePartnerDetailAssets((assetRows ?? []) as PartnerAsset[]),
    documents: (documentRows ?? []) as PartnerDocument[],
    performance: performanceBundle
  };
}

function flattenTrainingHistory(
  rows: TrainingAttendanceJoined[]
): PartnerTrainingHistoryItem[] {
  return rows.map((r) => {
    const t = Array.isArray(r.training) ? r.training[0] ?? null : r.training;
    return {
      id: r.id,
      training_id: r.training_id,
      training_name: t?.training_name ?? "(교육명 미상)",
      training_type: t?.training_type ?? null,
      product_name: t?.product_name ?? null,
      start_date: t?.start_date ?? null,
      end_date: t?.end_date ?? null,
      attendee_name: r.attendee_name ?? null,
      attendee_department: r.attendee_department ?? null,
      attendee_position: r.attendee_position ?? null,
      attended: r.attended,
      score: r.score ?? null,
      converted_score: r.converted_score ?? null,
      rank: r.rank ?? null,
      exam_status: r.exam_status ?? null,
      attendance_days: r.attendance_days ?? null,
      partial_days: r.partial_days ?? null,
      absent_days: r.absent_days ?? null,
      evaluation_result: r.evaluation_result ?? null,
      extra_json: (r.extra_json as Record<string, unknown> | null) ?? null
    };
  });
}

function groupTrainingSessions(
  rows: PartnerTrainingHistoryItem[]
): PartnerTrainingSessionGroup[] {
  const map = new Map<string, PartnerTrainingSessionGroup>();

  for (const row of rows) {
    const existing = map.get(row.training_id);
    if (!existing) {
      map.set(row.training_id, {
        training_id: row.training_id,
        training_name: row.training_name,
        training_type: row.training_type,
        start_date: row.start_date,
        end_date: row.end_date,
        description: null,
        is_tech_partner: /기술파트너/.test(row.training_name) || row.training_type === "기술파트너 교육",
        participants: [row],
        attendee_count: 1,
        exam_taken_count: row.exam_status === "응시" ? 1 : 0,
        avg_total_score: null,
        avg_converted_score: null
      });
      continue;
    }
    existing.participants.push(row);
    existing.attendee_count += 1;
    if (row.exam_status === "응시") existing.exam_taken_count += 1;
  }

  for (const session of map.values()) {
    const scores = session.participants
      .map((p) => p.score)
      .filter((v): v is number => v != null);
    const converted = session.participants
      .map((p) => p.converted_score)
      .filter((v): v is number => v != null);
    if (scores.length > 0) {
      session.avg_total_score =
        Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    }
    if (converted.length > 0) {
      session.avg_converted_score =
        Math.round((converted.reduce((a, b) => a + b, 0) / converted.length) * 10) / 10;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    (b.start_date ?? "").localeCompare(a.start_date ?? "")
  );
}

function flattenEventHistory(rows: EventAttendanceJoined[]): PartnerEventHistoryItem[] {
  return rows.map((r) => {
    const e = Array.isArray(r.event) ? r.event[0] ?? null : r.event;
    return {
      id: r.id,
      event_id: r.event_id,
      event_name: e?.event_name ?? "(행사명 미상)",
      event_type: e?.event_type ?? null,
      event_date: e?.event_date ?? null,
      location: e?.location ?? null,
      relation_type: r.attended ? "참석" : "관련",
      document_count: 0,
      source: "attendance",
      attendee_name: r.attendee_name ?? null,
      attendee_department: r.attendee_department ?? null,
      attendee_position: r.attendee_position ?? null,
      attended: r.attended
    };
  });
}
