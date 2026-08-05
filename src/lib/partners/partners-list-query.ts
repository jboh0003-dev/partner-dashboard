import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_PAGE_SIZE,
  clampPage,
  parsePageParam,
  rangeForPage,
  totalPagesFor
} from "@/components/common/list-pagination";
import {
  buildPartnerListRows,
  type PartnerListRow
} from "@/lib/partners/list";
import {
  getDisplayPartnerGrade,
  parseGradeQueryParam
} from "@/lib/partners/grade";
import {
  filterOfficialPartnerStatsPartners,
  isExcludedFromOfficialPartnerStats
} from "@/lib/partners/official-stats-exclude";
import { filterSamplePartners, isSamplePartner } from "@/lib/partners/sample-filter";
import type { Partner, PartnerContact } from "@/types/partner";

export const PARTNERS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export const PARTNER_LIST_SELECT =
  "id, company_name, external_no, grade, grade_override, grade_change_raw, grade_original, contract_start_date, region_group, status, is_active, deleted_at, memo, ceo_name, business_number, main_phone, sales_owner, okestro_owner, contract_contact_name, contract_contact_phone, contract_contact_email, created_at, updated_at";

export type PartnersListSearchParams = {
  q?: string;
  grade?: string;
  contractYear?: string;
  contractMonth?: string;
  includeExcluded?: string;
  page?: string;
};

function parseContractDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesContractFilters(
  partner: Partner,
  params: PartnersListSearchParams
): boolean {
  if (params.contractYear) {
    const year = Number(params.contractYear);
    if (Number.isFinite(year)) {
      const date = parseContractDate(partner.contract_start_date);
      if (date?.getFullYear() !== year) return false;
    }
  }
  if (params.contractMonth) {
    const match = /^(\d{4})-(\d{1,2})$/.exec(params.contractMonth.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const date = parseContractDate(partner.contract_start_date);
      if (!(date?.getFullYear() === year && date.getMonth() + 1 === month)) {
        return false;
      }
    }
  }
  return true;
}

async function findPartnerIdsMatchingContactQuery(
  supabase: SupabaseClient,
  q: string
): Promise<string[]> {
  const escaped = q.replace(/[%_,]/g, "");
  if (!escaped) return [];

  const { data, error } = await supabase
    .from("partner_contacts")
    .select("partner_id")
    .eq("is_active", true)
    .is("deleted_at", null)
    .or(
      `name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%,department.ilike.%${escaped}%,position.ilike.%${escaped}%`
    )
    .limit(2000);

  if (error) return [];
  return [...new Set((data ?? []).map((row) => String(row.partner_id)))];
}

/**
 * Partners list with server-side page window.
 *
 * Filter semantics (sample / official-exclude / display grade / contact search)
 * are preserved. When filters need display-grade or contact matching, we resolve
 * matching IDs first, then `range` the page of full rows + contacts for that page only.
 */
export async function fetchPartnersListPage(
  supabase: SupabaseClient,
  params: PartnersListSearchParams
): Promise<{
  rows: PartnerListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  includeExcluded: boolean;
  excludedCount: number;
  error: string | null;
  gradeToken: string | null;
}> {
  const pageSize = PARTNERS_PAGE_SIZE;
  const includeExcluded =
    params.includeExcluded === "1" || params.includeExcluded === "true";
  const gradeToken = parseGradeQueryParam(params.grade);
  const q = (params.q ?? "").trim();

  try {
    // Lightweight identity + filter/search fields (not full contact join)
    let query = supabase
      .from("partners")
      .select(
        "id, company_name, contract_display_name, external_no, memo, grade, grade_override, grade_change_raw, grade_original, contract_start_date, is_active, deleted_at, ceo_name, sales_owner, okestro_owner, main_phone, business_number, contract_contact_name, contract_contact_email, contract_contact_phone"
      )
      .is("deleted_at", null)
      .order("company_name", { ascending: true })
      .order("id", { ascending: true });

    // Prefer active (null treated as active in UI)
    query = query.or("is_active.is.null,is_active.eq.true");

    if (params.contractYear && Number.isFinite(Number(params.contractYear))) {
      const year = Number(params.contractYear);
      query = query
        .gte("contract_start_date", `${year}-01-01`)
        .lte("contract_start_date", `${year}-12-31`);
    } else if (params.contractMonth) {
      const match = /^(\d{4})-(\d{1,2})$/.exec(params.contractMonth.trim());
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const start = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = new Date(year, month, 0);
        const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
        query = query.gte("contract_start_date", start).lte("contract_start_date", end);
      }
    }

    const { data: lightRows, error: lightError } = await query.limit(5000);
    if (lightError) throw new Error(lightError.message);

    let candidates = filterSamplePartners(
      (lightRows ?? []) as unknown as Partner[]
    ).filter((p) => p.is_active !== false);

    const excludedCount = candidates.filter((p) =>
      isExcludedFromOfficialPartnerStats(p)
    ).length;

    if (!includeExcluded) {
      candidates = filterOfficialPartnerStatsPartners(candidates);
    }

    candidates = candidates.filter((p) => matchesContractFilters(p, params));

    if (gradeToken) {
      candidates = candidates.filter((p) => getDisplayPartnerGrade(p) === gradeToken);
    }

    let contactMatchIds: Set<string> | null = null;
    if (q) {
      const ids = await findPartnerIdsMatchingContactQuery(supabase, q);
      contactMatchIds = new Set(ids);
    }

    // Apply text search on partner fields (+ contact match ids) using list helpers
    // by building temporary rows without contacts first, then refining with contacts for matches.
    let matchedIds = candidates.map((p) => p.id);

    if (q) {
      const qLower = q.toLowerCase();
      matchedIds = candidates
        .filter((p) => {
          if (contactMatchIds?.has(p.id)) return true;
          const haystack = [
            p.company_name,
            p.external_no,
            p.ceo_name,
            p.sales_owner,
            p.okestro_owner,
            p.main_phone,
            p.business_number,
            p.contract_contact_name,
            p.contract_contact_email,
            p.contract_contact_phone,
            getDisplayPartnerGrade(p)
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(qLower);
        })
        .map((p) => p.id);
    }

    const totalCount = matchedIds.length;
    const totalPages = totalPagesFor(totalCount, pageSize);
    const page = clampPage(parsePageParam(params.page), totalPages || 1);
    const { from, to } = rangeForPage(page, pageSize);
    const pageIds = matchedIds.slice(from, to + 1);

    if (pageIds.length === 0) {
      return {
        rows: [],
        totalCount,
        page,
        pageSize,
        totalPages,
        includeExcluded,
        excludedCount,
        error: null,
        gradeToken
      };
    }

    const { data: partnersData, error: partnersError } = await supabase
      .from("partners")
      .select(PARTNER_LIST_SELECT)
      .in("id", pageIds)
      .is("deleted_at", null)
      // Page-sized fetch equivalent to range over the filtered id window
      .range(0, pageIds.length - 1);

    if (partnersError) throw new Error(partnersError.message);

    const partnerMap = new Map(
      ((partnersData ?? []) as Partner[]).map((p) => [p.id, p])
    );
    // Preserve sort order of pageIds
    const partners = pageIds
      .map((id) => partnerMap.get(id))
      .filter((p): p is Partner => Boolean(p) && !isSamplePartner(p));

    const { data: contactsData, error: contactsError } = await supabase
      .from("partner_contacts")
      .select(
        "id, partner_id, name, department, position, email, phone, is_primary, is_contract_contact, is_active, deleted_at"
      )
      .in("partner_id", pageIds)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (contactsError) throw new Error(contactsError.message);

    const contacts = (contactsData ?? []) as PartnerContact[];
    // Page IDs already reflect search (partner fields + contact matches)
    const rows = buildPartnerListRows(partners, contacts);

    return {
      rows,
      totalCount,
      page,
      pageSize,
      totalPages,
      includeExcluded,
      excludedCount,
      error: null,
      gradeToken
    };
  } catch (error) {
    return {
      rows: [],
      totalCount: 0,
      page: 1,
      pageSize,
      totalPages: 0,
      includeExcluded,
      excludedCount: 0,
      error: error instanceof Error ? error.message : "파트너 목록 조회 실패",
      gradeToken
    };
  }
}

export function buildPartnersListHref(
  params: PartnersListSearchParams,
  page: number
): string {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.grade && params.grade !== "all") sp.set("grade", params.grade);
  if (params.contractYear) sp.set("contractYear", params.contractYear);
  if (params.contractMonth) sp.set("contractMonth", params.contractMonth);
  if (params.includeExcluded === "1" || params.includeExcluded === "true") {
    sp.set("includeExcluded", "1");
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/dashboard/partners?${qs}` : "/dashboard/partners";
}
