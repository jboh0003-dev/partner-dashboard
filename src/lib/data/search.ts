import { createClient } from "@/lib/supabase/server";
import { CONTACT_ROLE_LABEL } from "@/lib/constants";
import {
  fetchCurrentPolicyChunksForSearch,
  fetchPolicyChunks
} from "@/lib/data/partner-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  filterRowsByPartnerId,
  filterRowsByPartnerName,
  filterSamplePartners,
  getRealPartnerIdSet
} from "@/lib/partners/sample-filter";
import type { PartnerKnowledgeRow } from "@/lib/search/knowledge";
import type { PartnerPolicyChunk, PartnerPolicyDocument } from "@/types/partner-policy";
import type { PartnerAsset } from "@/types/asset";
import type { PartnerDocument } from "@/types/document";
import {
  filterDisplayablePartnerEvents,
  PARTNER_EVENT_COLUMNS
} from "@/lib/events/event-display";
import type { PartnerPoc } from "@/types/poc";
import type { PartnerEventDocument, PartnerEventRecord } from "@/types/event";
import type { Partner, PartnerContact, PartnerNote } from "@/types/partner";
import type { Training, TrainingAttendance } from "@/types/training";

export type SearchAssetRow = PartnerAsset & {
  partner_name: string;
};

export type SearchDocumentRow = PartnerDocument & {
  partner_name: string;
};

export type SearchPocRow = PartnerPoc & {
  partner_name: string;
};

export type SearchAttendanceRow = TrainingAttendance & {
  partner_name: string;
  training_name: string;
  training_year: number | null;
  training_month: number | null;
  training_type: string | null;
  converted_score?: number | null;
  rank?: number | null;
  exam_status?: string | null;
};

export type SearchContext = {
  partners: Partner[];
  contacts: PartnerContact[];
  assets: SearchAssetRow[];
  documents: SearchDocumentRow[];
  pocs: SearchPocRow[];
  attendances: SearchAttendanceRow[];
  trainings: Training[];
  knowledge: PartnerKnowledgeRow[];
  policyDocument: PartnerPolicyDocument | null;
  policyChunks: PartnerPolicyChunk[];
  previousPolicyDocument: PartnerPolicyDocument | null;
  previousPolicyChunks: PartnerPolicyChunk[];
  notes: PartnerNote[];
  events: PartnerEventRecord[];
  eventDocuments: PartnerEventDocument[];
  fetchedAt: string;
};

export async function fetchSearchContext(): Promise<SearchContext> {
  const supabase = await createClient();
  const fetchedAt = new Date().toISOString();

  const [
    { data: partnersData },
    { data: contactsData },
    { data: assetsData },
    { data: documentsData },
    { data: pocsData },
    { data: attendancesData },
    { data: trainingsData },
    { data: knowledgeData },
    { data: notesData },
    { data: eventsData },
    { data: eventDocsData }
  ] = await Promise.all([
    supabase.from("partners").select("*").order("company_name", { ascending: true }),
    supabase.from("partner_contacts").select("*"),
    supabase
      .from("partner_assets")
      .select("*, partners!inner(company_name)")
      .order("updated_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("partner_documents")
      .select("*, partners!inner(company_name)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_pocs")
      .select("*, partners!inner(company_name)")
      .order("start_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("training_attendance")
      .select(
        "*, partners!inner(company_name), trainings!inner(training_name, training_year, training_month, training_type)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("trainings").select("*"),
    supabase
      .from("partner_knowledge")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("partner_notes").select("*").order("created_at", { ascending: false }),
    supabase
      .from("partner_events")
      .select(PARTNER_EVENT_COLUMNS)
      .order("event_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("partner_event_documents")
      .select("*")
      .order("uploaded_at", { ascending: false })
  ]);

  const { document: policyDocument, chunks: policyChunks } = await fetchCurrentPolicyChunksForSearch();

  let previousPolicyDocument: PartnerPolicyDocument | null = null;
  let previousPolicyChunks: PartnerPolicyChunk[] = [];

  if (policyDocument?.id) {
    const admin = createAdminClient();
    const { data: previousDocData } = await admin
      .from("partner_policy_documents")
      .select("*")
      .eq("status", "active")
      .eq("is_current", false)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousDocData) {
      previousPolicyDocument = previousDocData as PartnerPolicyDocument;
      previousPolicyChunks = await fetchPolicyChunks(previousPolicyDocument.id, true);
    }
  }

  return {
    partners: filterSamplePartners((partnersData ?? []) as Partner[]),
    contacts: filterRowsByPartnerId(
      (contactsData ?? []) as PartnerContact[],
      getRealPartnerIdSet((partnersData ?? []) as Partner[])
    ),
    assets: filterRowsByPartnerName(mapAssets(assetsData ?? [])),
    documents: filterRowsByPartnerName(mapDocuments(documentsData ?? [])),
    pocs: filterRowsByPartnerName(mapPocs(pocsData ?? [])),
    attendances: filterRowsByPartnerName(mapAttendances(attendancesData ?? [])),
    trainings: (trainingsData ?? []) as Training[],
    knowledge: (knowledgeData ?? []) as PartnerKnowledgeRow[],
    policyDocument,
    policyChunks,
    previousPolicyDocument,
    previousPolicyChunks,
    notes: filterRowsByPartnerId(
      (notesData ?? []) as PartnerNote[],
      getRealPartnerIdSet((partnersData ?? []) as Partner[])
    ),
    events: filterDisplayablePartnerEvents((eventsData ?? []) as PartnerEventRecord[]),
    eventDocuments: (eventDocsData ?? []) as PartnerEventDocument[],
    fetchedAt
  };
}

function mapAssets(rows: unknown[]): SearchAssetRow[] {
  return rows.map((row) => {
    const item = row as Record<string, unknown> & {
      partners?: { company_name: string } | Array<{ company_name: string }>;
    };
    const partner = Array.isArray(item.partners) ? item.partners[0] : item.partners;
    const { partners: _partners, ...asset } = item;
    return {
      ...(asset as PartnerAsset),
      partner_name: partner?.company_name ?? "(미상)"
    };
  });
}

function mapDocuments(rows: unknown[]): SearchDocumentRow[] {
  return rows.map((row) => {
    const item = row as Record<string, unknown> & {
      partners?: { company_name: string } | Array<{ company_name: string }>;
    };
    const partner = Array.isArray(item.partners) ? item.partners[0] : item.partners;
    const { partners: _partners, ...document } = item;
    return {
      ...(document as PartnerDocument),
      partner_name: partner?.company_name ?? "(미상)"
    };
  });
}

function mapPocs(rows: unknown[]): SearchPocRow[] {
  return rows.map((row) => {
    const item = row as Record<string, unknown> & {
      partners?: { company_name: string } | Array<{ company_name: string }>;
    };
    const partner = Array.isArray(item.partners) ? item.partners[0] : item.partners;
    const { partners: _partners, ...poc } = item;
    return {
      ...(poc as PartnerPoc),
      partner_name: partner?.company_name ?? "(미상)"
    };
  });
}

function mapAttendances(rows: unknown[]): SearchAttendanceRow[] {
  return rows.map((row) => {
    const item = row as Record<string, unknown> & {
      partners?: { company_name: string } | Array<{ company_name: string }>;
      trainings?:
        | {
            training_name: string;
            training_year: number | null;
            training_month: number | null;
            training_type: string | null;
          }
        | Array<{
            training_name: string;
            training_year: number | null;
            training_month: number | null;
            training_type: string | null;
          }>;
    };
    const partner = Array.isArray(item.partners) ? item.partners[0] : item.partners;
    const training = Array.isArray(item.trainings) ? item.trainings[0] : item.trainings;
    const { partners: _partners, trainings: _trainings, ...attendance } = item;

    return {
      ...(attendance as TrainingAttendance),
      partner_name: partner?.company_name ?? "(미상)",
      training_name: training?.training_name ?? "-",
      training_year: training?.training_year ?? null,
      training_month: training?.training_month ?? null,
      training_type: training?.training_type ?? null
    };
  });
}

export function formatContactRole(role: string | null | undefined): string {
  if (!role) return "-";
  return CONTACT_ROLE_LABEL[role] ?? role;
}

export function latestTimestamp(values: Array<string | null | undefined>): string | null {
  const timestamps = values
    .filter((value): value is string => !!value?.trim())
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export function formatCriteriaDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}
