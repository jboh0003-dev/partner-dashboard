import { createClient } from "@/lib/supabase/server";
import {
  getDocumentDisplayFileName,
  getDocumentTypeShortLabel,
  resolveMatchStatus
} from "@/lib/documents/display";
import {
  countAsActiveNeedsReview,
  isExcludedReview,
  shouldAppearInNeedsReviewFilter
} from "@/lib/documents/review-status";
import { isSamplePartnerName } from "@/lib/partners/sample-filter";
import type { DocumentMatchStatus } from "@/lib/documents/constants";
import type { PartnerDocumentWithPartner } from "@/types/document";

export type DocumentListFilters = {
  q?: string;
  type?: string;
  status?: string;
  visibility?: string;
  advanced?: boolean;
};

function searchScore(row: PartnerDocumentWithPartner, query: string, advanced: boolean): number {
  const q = query.toLowerCase();
  let score = 0;

  if (row.partner_name.toLowerCase().includes(q)) score += 100;
  if (row.extracted_partner_name?.toLowerCase().includes(q)) score += 90;
  if (getDocumentTypeShortLabel(row.document_type).toLowerCase().includes(q)) score += 70;
  if (getDocumentDisplayFileName(row).toLowerCase().includes(q)) score += 60;

  if (advanced) {
    if (row.original_filename?.toLowerCase().includes(q)) score += 20;
    if (row.file_name?.toLowerCase().includes(q)) score += 15;
  }

  return score;
}

export async function fetchDocumentList(filters: DocumentListFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("partner_documents")
    .select("*, partners!inner(company_name)")
    .is("deleted_at", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.type && filters.type !== "all") {
    query = query.eq("document_type", filters.type);
  }

  if (filters.status && filters.status !== "all") {
    // match_status는 mapDocumentRow 이후 effective status로 재필터
  }

  const visibility = filters.visibility ?? "active";
  if (visibility === "active") {
    query = query.eq("is_active", true).eq("is_duplicate", false);
  } else if (visibility === "hidden") {
    query = query.eq("is_duplicate", true);
  } else if (visibility === "duplicate_candidate") {
    query = query.eq("duplicate_reason", "near_duplicate_candidate");
  } else if (visibility === "needs_review") {
    query = query
      .eq("is_active", true)
      .eq("is_duplicate", false)
      .not("review_status", "in", "(manually_confirmed,excluded)")
      .or("duplicate_reason.eq.near_duplicate_candidate,match_status.eq.needs_review,review_status.eq.needs_review");
  }

  const { data, error } = await query;
  let rows: PartnerDocumentWithPartner[] = (data ?? [])
    .map((row) => mapDocumentRow(row))
    .filter((row) => !isSamplePartnerName(row.partner_name))
    .filter((row) => visibility !== "active" || !isExcludedReview(row.review_status));

  if (filters.status && filters.status !== "all") {
    rows = rows.filter((row) => {
      const effective = resolveMatchStatus(row);
      if (filters.status === "matched") return effective === "matched";
      if (filters.status === "needs_review") return shouldAppearInNeedsReviewFilter(row);
      if (filters.status === "unmatched") return effective === "unmatched";
      return true;
    });
  }

  if (visibility === "needs_review") {
    rows = rows.filter((row) => shouldAppearInNeedsReviewFilter(row));
  }

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    rows = rows
      .map((row) => ({ row, score: searchScore(row, q, !!filters.advanced) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.row);
  }

  return { rows, error };
}

export async function fetchDocumentTypeOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_documents")
    .select("document_type")
    .is("deleted_at", null);
  return uniqueSorted(
    (data ?? [])
      .map((r) => (r as { document_type: string | null }).document_type)
      .filter((v): v is string => !!v)
  );
}

export async function fetchPartnerOptionsForDocuments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partners")
    .select("id, company_name, external_no")
    .order("company_name", { ascending: true });
  return (data ?? []).map((row) => ({
    id: String(row.id),
    company_name: String(row.company_name),
    external_no: (row.external_no as string | null) ?? null
  })).filter((row) => !isSamplePartnerName(row.company_name));
}

export async function countDocumentsNeedingReview() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_documents")
    .select(
      "id, partner_id, match_status, review_status, is_active, is_duplicate, duplicate_reason, document_type, extracted_partner_name, summary, contract_date, period_year, partners!inner(company_name)"
    )
    .is("deleted_at", null)
    .eq("is_active", true)
    .eq("is_duplicate", false)
    .not("review_status", "in", "(manually_confirmed,excluded)");

  return (data ?? [])
    .map((row) => mapDocumentRow(row))
    .filter((row) => !isSamplePartnerName(row.partner_name))
    .filter((row) => countAsActiveNeedsReview(row)).length;
}

/** @deprecated countDocumentsNeedingReview 사용 */
export async function countDocumentsByStatus(status: DocumentMatchStatus) {
  if (status === "needs_review") {
    return countDocumentsNeedingReview();
  }
  const supabase = await createClient();
  const { count } = await supabase
    .from("partner_documents")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("match_status", status);
  return count ?? 0;
}

function mapDocumentRow(row: Record<string, unknown>): PartnerDocumentWithPartner {
  const partners = row.partners as { company_name: string } | { company_name: string }[];
  const partner = Array.isArray(partners) ? partners[0] : partners;
  const doc = row as Record<string, unknown> & { partners?: unknown };

  const mapped: PartnerDocumentWithPartner = {
    id: String(doc.id),
    partner_id: String(doc.partner_id),
    partner_name_raw: (doc.partner_name_raw as string | null) ?? null,
    document_type: (doc.document_type as string | null) ?? null,
    document_status: (doc.document_status as string | null) ?? null,
    original_filename: (doc.original_filename as string | null) ?? null,
    display_name: (doc.display_name as string | null) ?? null,
    file_name: String(doc.file_name ?? doc.original_filename ?? ""),
    file_path: (doc.file_path as string | null) ?? null,
    storage_path: (doc.storage_path as string | null) ?? null,
    file_url: (doc.file_url as string | null) ?? null,
    file_ext: (doc.file_ext as string | null) ?? null,
    file_size: (doc.file_size as number | null) ?? null,
    source_folder: (doc.source_folder as string | null) ?? null,
    source_file: (doc.source_file as string | null) ?? null,
    received_date: (doc.received_date as string | null) ?? null,
    contract_date: (doc.contract_date as string | null) ?? null,
    partner_no: (doc.partner_no as string | null) ?? null,
    grade_from_file: (doc.grade_from_file as string | null) ?? null,
    period_year: (doc.period_year as number | null) ?? null,
    period_quarter: (doc.period_quarter as string | null) ?? null,
    period_month: (doc.period_month as number | null) ?? null,
    is_primary: (doc.is_primary as boolean | null) ?? null,
    priority_score: (doc.priority_score as number | null) ?? null,
    is_active: (doc.is_active as boolean | null) ?? true,
    is_duplicate: (doc.is_duplicate as boolean | null) ?? false,
    duplicate_of: (doc.duplicate_of as string | null) ?? null,
    duplicate_reason: (doc.duplicate_reason as string | null) ?? null,
    representative: (doc.representative as boolean | null) ?? null,
    upload_batch_id: (doc.upload_batch_id as string | null) ?? null,
    file_hash: (doc.file_hash as string | null) ?? null,
    archived_at: (doc.archived_at as string | null) ?? null,
    archived_reason: (doc.archived_reason as string | null) ?? null,
    match_source: (doc.match_source as string | null) ?? null,
    review_status: (doc.review_status as string | null) ?? null,
    review_resolved_at: (doc.review_resolved_at as string | null) ?? null,
    extracted_partner_name: (doc.extracted_partner_name as string | null) ?? null,
    match_confidence: (doc.match_confidence as number | null) ?? null,
    match_status:
      (doc.match_status as string | null) ??
      resolveMatchStatus({ review_status: doc.review_status as string | null }),
    match_method: (doc.match_method as string | null) ?? null,
    summary: (doc.summary as string | null) ?? null,
    note: (doc.note as string | null) ?? null,
    uploaded_by: (doc.uploaded_by as string | null) ?? null,
    created_at: String(doc.created_at),
    updated_at: (doc.updated_at as string | null) ?? null,
    deleted_at: (doc.deleted_at as string | null) ?? null,
    partner_name: partner?.company_name ?? "(미상)"
  };

  mapped.match_status = resolveMatchStatus(mapped);

  return mapped;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) =>
    a.localeCompare(b, "ko-KR", { numeric: true })
  );
}
