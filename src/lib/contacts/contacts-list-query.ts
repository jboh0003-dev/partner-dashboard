import type { SupabaseClient } from "@supabase/supabase-js";
import { BASELINE_EXCLUDED_REASON } from "@/lib/imports/partner-contacts";
import type { ContactListView } from "@/lib/contacts/contact-views";
import {
  dedupePersonRows,
  mapContactToPersonRow,
  type ContactListDbRow
} from "@/lib/contacts/map-contact-list-row";
import type { PersonContactRow } from "@/lib/contacts/person-groups";

export const CONTACTS_PAGE_SIZE_DEFAULT = 50;
export const CONTACTS_PAGE_SIZE_MAX = 100;

export const CONTACT_LIST_SELECT =
  "id, partner_id, name, department, position, role_type, role_raw, email, phone, phone_display, phone_normalized, is_contract_contact, is_primary, review_required, review_reason, memo, created_at, is_active, in_current_full_db";

export function normalizeContactsRoleFilter(role?: string | null): string {
  const normalized = (role ?? "").trim();
  return normalized || "all";
}

export type ContactsListQueryInput = {
  view: ContactListView;
  page: number;
  pageSize: number;
  partnerId?: string;
  q?: string;
  role?: string;
  bouncedContactIds?: string[];
};

export type ContactsListQueryResult = {
  rows: PersonContactRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error: string | null;
  usedFallbackQuery: boolean;
};

export type ContactsQuickStats = {
  activeCount: number;
  reviewCount: number;
  excludedCount: number;
  error: string | null;
};

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("column") &&
    (lower.includes("does not exist") ||
      lower.includes("in_current_full_db") ||
      lower.includes("contact_source") ||
      lower.includes("merged_into_contact_id") ||
      lower.includes("merge_keep_separate"))
  );
}

function clampPageSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return CONTACTS_PAGE_SIZE_DEFAULT;
  return Math.min(CONTACTS_PAGE_SIZE_MAX, Math.max(1, Math.floor(value)));
}

function applyListFilters(query: any, input: ContactsListQueryInput, useBaselineColumns: boolean) {
  let filtered = query.is("deleted_at", null);

  if (useBaselineColumns) {
    filtered = filtered.is("merged_into_contact_id", null);
  }

  switch (input.view) {
    case "inactive":
      filtered = useBaselineColumns
        ? filtered.eq("is_active", false).eq("in_current_full_db", false)
        : filtered.eq("is_active", false);
      break;
    case "excluded":
      filtered = filtered.eq("review_reason", BASELINE_EXCLUDED_REASON);
      break;
    case "history_only":
      filtered = useBaselineColumns
        ? filtered.eq("in_current_full_db", false).eq("is_active", false)
        : filtered.eq("is_active", false);
      break;
    case "review":
      filtered = useBaselineColumns
        ? filtered.eq("review_required", true).eq("in_current_full_db", true)
        : filtered.eq("review_required", true);
      break;
    case "bounced":
      filtered = useBaselineColumns
        ? filtered.eq("is_active", true).eq("in_current_full_db", true)
        : filtered.eq("is_active", true);
      break;
    default:
      filtered = useBaselineColumns
        ? filtered.eq("is_active", true).eq("in_current_full_db", true)
        : filtered.eq("is_active", true);
  }

  if (input.partnerId) {
    filtered = filtered.eq("partner_id", input.partnerId);
  }

  const q = input.q?.trim();
  if (q) {
    const escaped = q.replace(/[%_,]/g, "");
    filtered = filtered.or(
      `name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,department.ilike.%${escaped}%,position.ilike.%${escaped}%`
    );
  }

  const role = normalizeContactsRoleFilter(input.role);
  if (role === "contract_contact") {
    filtered = filtered.eq("is_contract_contact", true);
  } else if (role !== "all") {
    filtered = filtered.eq("role_type", role);
  }

  if (input.view === "bounced") {
    if (input.bouncedContactIds && input.bouncedContactIds.length > 0) {
      filtered = filtered.in("id", input.bouncedContactIds);
    } else {
      filtered = filtered.or("review_reason.ilike.%반송%,review_reason.ilike.%발송%");
    }
  }

  return filtered;
}

async function attachPartnersToRows(
  supabase: SupabaseClient,
  rows: ContactListDbRow[]
): Promise<ContactListDbRow[]> {
  const partnerIds = [...new Set(rows.map((row) => row.partner_id).filter(Boolean))];
  if (partnerIds.length === 0) return rows;

  const { data: partners, error } = await supabase
    .from("partners")
    .select("id, company_name, external_no")
    .in("id", partnerIds);

  if (error) {
    return rows;
  }

  const partnerMap = new Map(
    (partners ?? []).map((partner) => [
      String(partner.id),
      {
        company_name: String(partner.company_name),
        external_no: partner.external_no ? String(partner.external_no) : null
      }
    ])
  );

  return rows.map((row) => ({
    ...row,
    partner: partnerMap.get(row.partner_id) ?? null
  }));
}

async function runListQuery(
  supabase: SupabaseClient,
  input: ContactsListQueryInput,
  useBaselineColumns: boolean
): Promise<ContactsListQueryResult> {
  const pageSize = clampPageSize(input.pageSize);
  const page = Math.max(1, input.page);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (input.view === "merge") {
    return {
      rows: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      error: null,
      usedFallbackQuery: !useBaselineColumns
    };
  }

  let query = applyListFilters(
    supabase.from("partner_contacts").select(CONTACT_LIST_SELECT),
    input,
    useBaselineColumns
  );

  const countQuery = applyListFilters(
    supabase.from("partner_contacts").select("id", { count: "exact", head: true }),
    input,
    useBaselineColumns
  );

  const [{ count, error: countError }, { data, error }] = await Promise.all([
    countQuery,
    query.order("name", { ascending: true }).order("id", { ascending: true }).range(from, to)
  ]);

  if (countError) {
    throw new Error(countError.message);
  }

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;
  const rawRows = (data ?? []) as ContactListDbRow[];
  const rowsWithPartners = await attachPartnersToRows(supabase, rawRows);
  let rows = rowsWithPartners.map((row) => mapContactToPersonRow(row));

  if (input.view === "review") {
    rows = dedupePersonRows(rows);
  }

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
    error: null,
    usedFallbackQuery: !useBaselineColumns
  };
}

export async function fetchContactsListPage(
  supabase: SupabaseClient,
  input: ContactsListQueryInput
): Promise<ContactsListQueryResult> {
  try {
    return await runListQuery(supabase, input, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : "목록 조회 실패";
    if (!isMissingColumnError(message)) {
      return {
        rows: [],
        total: 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: 0,
        error: message,
        usedFallbackQuery: false
      };
    }

    try {
      return await runListQuery(supabase, input, false);
    } catch (fallbackError) {
      return {
        rows: [],
        total: 0,
        page: input.page,
        pageSize: input.pageSize,
        totalPages: 0,
        error:
          fallbackError instanceof Error ? fallbackError.message : "목록 조회 실패 (fallback)",
        usedFallbackQuery: true
      };
    }
  }
}

export async function fetchContactsQuickStats(
  supabase: SupabaseClient
): Promise<ContactsQuickStats> {
  try {
    const [activeRes, reviewRes, excludedRes] = await Promise.all([
      supabase
        .from("partner_contacts")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("in_current_full_db", true)
        .is("deleted_at", null)
        .is("merged_into_contact_id", null),
      supabase
        .from("partner_contacts")
        .select("id", { count: "exact", head: true })
        .eq("review_required", true)
        .eq("in_current_full_db", true)
        .is("deleted_at", null)
        .is("merged_into_contact_id", null),
      supabase
        .from("partner_contacts")
        .select("id", { count: "exact", head: true })
        .eq("review_reason", BASELINE_EXCLUDED_REASON)
        .is("deleted_at", null)
        .is("merged_into_contact_id", null)
    ]);

    if (activeRes.error) throw new Error(activeRes.error.message);
    if (reviewRes.error) throw new Error(reviewRes.error.message);
    if (excludedRes.error) throw new Error(excludedRes.error.message);

    return {
      activeCount: activeRes.count ?? 0,
      reviewCount: reviewRes.count ?? 0,
      excludedCount: excludedRes.count ?? 0,
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "통계 조회 실패";
    if (!isMissingColumnError(message)) {
      return { activeCount: 0, reviewCount: 0, excludedCount: 0, error: message };
    }

    try {
      const activeRes = await supabase
        .from("partner_contacts")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .is("deleted_at", null);
      const reviewRes = await supabase
        .from("partner_contacts")
        .select("id", { count: "exact", head: true })
        .eq("review_required", true)
        .is("deleted_at", null);

      return {
        activeCount: activeRes.count ?? 0,
        reviewCount: reviewRes.count ?? 0,
        excludedCount: 0,
        error: activeRes.error?.message ?? reviewRes.error?.message ?? null
      };
    } catch (fallbackError) {
      return {
        activeCount: 0,
        reviewCount: 0,
        excludedCount: 0,
        error: fallbackError instanceof Error ? fallbackError.message : message
      };
    }
  }
}

export async function fetchBouncedContactIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase
    .from("contact_emails")
    .select("contact_id")
    .or("is_bounced.eq.true,is_sendable.eq.false")
    .limit(2000);

  if (error) return [];
  return [...new Set((data ?? []).map((row) => row.contact_id as string))];
}
