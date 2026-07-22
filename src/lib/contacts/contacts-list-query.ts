import type { SupabaseClient } from "@supabase/supabase-js";
import { BASELINE_EXCLUDED_REASON } from "@/lib/imports/partner-contacts";
import type { ContactListView } from "@/lib/contacts/contact-views";
import {
  dedupePersonRows,
  mapContactToPersonRow,
  type ContactListDbRow
} from "@/lib/contacts/map-contact-list-row";
import type { PersonContactRow } from "@/lib/contacts/person-groups";
import { normalizeCompanyName } from "@/lib/partner-match";

/** 기본 목록은 페이지네이션 없이 전체 조회 (현재 전체DB ~600명 수준) */
export const CONTACTS_LIST_MAX = 5000;

export const CONTACT_LIST_SELECT =
  "id, partner_id, name, department, position, role_type, role_raw, email, phone, phone_display, phone_normalized, is_contract_contact, is_primary, review_required, review_reason, memo, created_at, is_active, in_current_full_db";

export function normalizeContactsRoleFilter(role?: string | null): string {
  const normalized = (role ?? "").trim();
  return normalized || "all";
}

export type ContactsListQueryInput = {
  view: ContactListView;
  partnerId?: string;
  q?: string;
  role?: string;
  bouncedContactIds?: string[];
  /** 회사명 검색으로 매칭된 partner_id (inner join 없이 or 조건에 사용) */
  companyMatchPartnerIds?: string[];
};

export type ContactsListQueryResult = {
  rows: PersonContactRow[];
  total: number;
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

export function buildContactsCountLabel(input: {
  total: number;
  view: ContactListView;
  q?: string;
  role?: string;
  partnerId?: string;
}): string {
  const total = input.total.toLocaleString("ko-KR");
  const q = (input.q ?? "").trim();
  const role = normalizeContactsRoleFilter(input.role);
  const hasPartner = Boolean((input.partnerId ?? "").trim());
  const hasViewFilter = input.view !== "all";

  if (q) return `검색 결과 ${total}명`;
  if (role !== "all" || hasPartner || hasViewFilter) return `필터 결과 ${total}명`;
  return `현재 전체DB 기준 ${total}명`;
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
    const clauses = [
      `name.ilike.%${escaped}%`,
      `email.ilike.%${escaped}%`,
      `phone.ilike.%${escaped}%`,
      `department.ilike.%${escaped}%`,
      `position.ilike.%${escaped}%`
    ];
    if (input.companyMatchPartnerIds && input.companyMatchPartnerIds.length > 0) {
      clauses.push(`partner_id.in.(${input.companyMatchPartnerIds.join(",")})`);
    }
    filtered = filtered.or(clauses.join(","));
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

async function resolveCompanyMatchPartnerIds(
  supabase: SupabaseClient,
  q: string
): Promise<string[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name")
    .is("deleted_at", null)
    .limit(2000);

  if (error) throw new Error(error.message);

  const needleRaw = trimmed.toLowerCase();
  const needleCompact = needleRaw.replace(/\s+/g, "");
  const needleNorm = normalizeCompanyName(trimmed) ?? needleCompact;

  return (data ?? [])
    .filter((partner) => {
      const name = String(partner.company_name ?? "");
      if (!name) return false;
      const lower = name.toLowerCase();
      if (lower.includes(needleRaw)) return true;
      if (lower.replace(/\s+/g, "").includes(needleCompact)) return true;
      const norm = normalizeCompanyName(name);
      return Boolean(norm && needleNorm && norm.includes(needleNorm));
    })
    .map((partner) => String(partner.id));
}

async function runListQuery(
  supabase: SupabaseClient,
  input: ContactsListQueryInput,
  useBaselineColumns: boolean
): Promise<ContactsListQueryResult> {
  if (input.view === "merge") {
    return {
      rows: [],
      total: 0,
      error: null,
      usedFallbackQuery: !useBaselineColumns
    };
  }

  const q = input.q?.trim();
  const companyMatchPartnerIds = q
    ? await resolveCompanyMatchPartnerIds(supabase, q)
    : [];

  const queryInput: ContactsListQueryInput = {
    ...input,
    companyMatchPartnerIds
  };

  let query = applyListFilters(
    supabase.from("partner_contacts").select(CONTACT_LIST_SELECT),
    queryInput,
    useBaselineColumns
  );

  const countQuery = applyListFilters(
    supabase.from("partner_contacts").select("id", { count: "exact", head: true }),
    queryInput,
    useBaselineColumns
  );

  const [{ count, error: countError }, { data, error }] = await Promise.all([
    countQuery,
    query
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(0, CONTACTS_LIST_MAX - 1)
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
    error: null,
    usedFallbackQuery: !useBaselineColumns
  };
}

export async function fetchContactsList(
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
