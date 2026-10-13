import type { SupabaseClient } from "@supabase/supabase-js";
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

export const PARTNERS_LIST_MAX = 5000;

export const PARTNER_LIST_SELECT =
  "id, company_name, external_no, grade, grade_override, grade_change_raw, grade_original, contract_start_date, region_group, region, city, address, status, is_active, deleted_at, memo, ceo_name, business_number, main_phone, sales_owner, okestro_owner, contract_contact_name, contract_contact_phone, contract_contact_email, created_at, updated_at";

export type PartnersListSearchParams = {
  q?: string;
  partnerId?: string;
  grade?: string;
  regionGroup?: string;
  region?: string;
  contractYear?: string;
  contractMonth?: string;
  includeExcluded?: string;
};

export type PartnerListFilterOptions = {
  partners: Array<{ id: string; company_name: string; external_no: string | null }>;
  regionGroups: string[];
  regions: string[];
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

function cleanFilter(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed === "all" ? "" : trimmed;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b, "ko-KR"));
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
    .limit(PARTNERS_LIST_MAX);

  if (error) return [];
  return [...new Set((data ?? []).map((row) => String(row.partner_id)))];
}

export async function fetchPartnersList(
  supabase: SupabaseClient,
  params: PartnersListSearchParams
): Promise<{
  rows: PartnerListRow[];
  totalCount: number;
  includeExcluded: boolean;
  excludedCount: number;
  error: string | null;
  gradeToken: string | null;
  filterOptions: PartnerListFilterOptions;
}> {
  const includeExcluded =
    params.includeExcluded === "1" || params.includeExcluded === "true";
  const gradeToken = parseGradeQueryParam(params.grade);
  const q = (params.q ?? "").trim();
  const partnerId = cleanFilter(params.partnerId);
  const regionGroup = cleanFilter(params.regionGroup);
  const region = cleanFilter(params.region);

  const emptyFilterOptions: PartnerListFilterOptions = {
    partners: [],
    regionGroups: [],
    regions: []
  };

  try {
    const { data: lightRows, error: lightError } = await supabase
      .from("partners")
      .select(PARTNER_LIST_SELECT)
      .is("deleted_at", null)
      .order("company_name", { ascending: true })
      .order("id", { ascending: true })
      .or("is_active.is.null,is_active.eq.true")
      .limit(PARTNERS_LIST_MAX);

    if (lightError) throw new Error(lightError.message);

    const allPartners = filterSamplePartners(
      (lightRows ?? []) as unknown as Partner[]
    ).filter((partner) => partner.is_active !== false);

    const filterOptions: PartnerListFilterOptions = {
      partners: allPartners
        .map((partner) => ({
          id: partner.id,
          company_name: partner.company_name,
          external_no: partner.external_no ?? null
        }))
        .sort((a, b) => a.company_name.localeCompare(b.company_name, "ko-KR")),
      regionGroups: uniqueSorted(allPartners.map((partner) => partner.region_group)),
      regions: uniqueSorted(allPartners.map((partner) => partner.region))
    };

    const excludedCount = allPartners.filter((partner) =>
      isExcludedFromOfficialPartnerStats(partner)
    ).length;

    let candidates = includeExcluded
      ? allPartners
      : filterOfficialPartnerStatsPartners(allPartners);

    candidates = candidates.filter((partner) => matchesContractFilters(partner, params));

    if (partnerId) {
      candidates = candidates.filter((partner) => partner.id === partnerId);
    }
    if (gradeToken) {
      candidates = candidates.filter(
        (partner) => getDisplayPartnerGrade(partner) === gradeToken
      );
    }
    if (regionGroup) {
      candidates = candidates.filter(
        (partner) => partner.region_group?.trim() === regionGroup
      );
    }
    if (region) {
      candidates = candidates.filter(
        (partner) => partner.region?.trim() === region
      );
    }

    let contactMatchIds: Set<string> | null = null;
    if (q) {
      contactMatchIds = new Set(await findPartnerIdsMatchingContactQuery(supabase, q));
    }

    let matchedIds = candidates.map((partner) => partner.id);

    if (q) {
      const qLower = q.toLowerCase();
      matchedIds = candidates
        .filter((partner) => {
          if (contactMatchIds?.has(partner.id)) return true;
          const haystack = [
            partner.company_name,
            partner.external_no,
            partner.ceo_name,
            partner.sales_owner,
            partner.okestro_owner,
            partner.main_phone,
            partner.business_number,
            partner.region_group,
            partner.region,
            partner.city,
            partner.contract_contact_name,
            partner.contract_contact_email,
            partner.contract_contact_phone,
            getDisplayPartnerGrade(partner)
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(qLower);
        })
        .map((partner) => partner.id);
    }

    const totalCount = matchedIds.length;
    if (matchedIds.length === 0) {
      return {
        rows: [],
        totalCount,
        includeExcluded,
        excludedCount,
        error: null,
        gradeToken,
        filterOptions
      };
    }

    const contactsRes = await supabase
      .from("partner_contacts")
      .select(
        "id, partner_id, name, department, position, email, phone, is_primary, is_contract_contact, is_active, deleted_at"
      )
      .in("partner_id", matchedIds)
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(PARTNERS_LIST_MAX);

    if (contactsRes.error) throw new Error(contactsRes.error.message);

    const partnerMap = new Map(
      allPartners.map((partner) => [partner.id, partner])
    );
    const partners = matchedIds
      .map((id) => partnerMap.get(id))
      .filter((partner): partner is Partner => Boolean(partner) && !isSamplePartner(partner));

    const contacts = (contactsRes.data ?? []) as PartnerContact[];
    const rows = buildPartnerListRows(partners, contacts);

    return {
      rows,
      totalCount,
      includeExcluded,
      excludedCount,
      error: null,
      gradeToken,
      filterOptions
    };
  } catch (error) {
    return {
      rows: [],
      totalCount: 0,
      includeExcluded,
      excludedCount: 0,
      error: error instanceof Error ? error.message : "파트너 목록 조회 실패",
      gradeToken,
      filterOptions: emptyFilterOptions
    };
  }
}
