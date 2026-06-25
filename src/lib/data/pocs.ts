import { createClient } from "@/lib/supabase/server";
import { filterRowsByPartnerName } from "@/lib/partners/sample-filter";
import type { PartnerPocWithPartner } from "@/types/poc";

export type PocListFilters = {
  q?: string;
  status?: string;
  product?: string;
};

/**
 * PoC 현황 목록 — 파트너사명 join.
 * AI 에이전트가 "A파트너 PoC 경력" 질의 시 재사용 가능.
 */
export async function fetchPocList(filters: PocListFilters = {}) {
  const supabase = await createClient();

  let query = supabase
    .from("partner_pocs")
    .select("*, partners!inner(company_name)")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("result_status", filters.status);
  }
  if (filters.product && filters.product !== "all") {
    query = query.eq("product_name", filters.product);
  }

  const { data, error } = await query;
  let rows: PartnerPocWithPartner[] = (data ?? []).map((row) => {
    const partners = row.partners as { company_name: string } | { company_name: string }[];
    const partner = Array.isArray(partners) ? partners[0] : partners;
    const poc = row as Record<string, unknown> & { partners?: unknown };
    return {
      id: String(poc.id),
      partner_id: String(poc.partner_id),
      poc_name: (poc.poc_name as string | null) ?? null,
      customer_name: (poc.customer_name as string | null) ?? null,
      product_name: (poc.product_name as string | null) ?? null,
      start_date: (poc.start_date as string | null) ?? null,
      end_date: (poc.end_date as string | null) ?? null,
      role_description: (poc.role_description as string | null) ?? null,
      result_status: (poc.result_status as string | null) ?? null,
      result_summary: (poc.result_summary as string | null) ?? null,
      memo: (poc.memo as string | null) ?? null,
      created_at: String(poc.created_at),
      partner_name: partner?.company_name ?? "(미상)"
    };
  });

  rows = filterRowsByPartnerName(rows);

  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.poc_name, r.customer_name, r.product_name, r.partner_name, r.result_summary, r.memo]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }

  return { rows, error };
}

export async function fetchPocFilterOptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_pocs")
    .select("result_status, product_name");
  const statuses = uniqueSorted(
    (data ?? [])
      .map((r) => (r as { result_status: string | null }).result_status)
      .filter((v): v is string => !!v)
  );
  const products = uniqueSorted(
    (data ?? [])
      .map((r) => (r as { product_name: string | null }).product_name)
      .filter((v): v is string => !!v)
  );
  return { statuses, products };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) =>
    a.localeCompare(b, "ko-KR", { numeric: true })
  );
}
