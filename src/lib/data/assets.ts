import { aggregateAssetsByPartner, type AssetPartnerSummary } from "@/lib/assets/aggregate";
import { isSamplePartnerName } from "@/lib/partners/sample-filter";
import { createClient } from "@/lib/supabase/server";
import { PARTNER_GRADE_LABEL } from "@/lib/constants";
import type { PartnerAsset } from "@/types/asset";

export type AssetListRow = PartnerAsset & {
  partner_name: string;
  partner_grade: string | null;
  partner_grade_label: string;
};

export type AssetListFilters = {
  q?: string;
  grade?: string;
  status?: string;
  nodeType?: string;
  review?: string;
};

export type { AssetPartnerSummary };

export async function fetchAssetPartnerSummaries(filters: AssetListFilters = {}) {
  const { rows, error } = await fetchAssetList(filters);
  return {
    rows: aggregateAssetsByPartner(rows),
    error
  };
}

export async function fetchAssetList(filters: AssetListFilters = {}) {
  const supabase = await createClient();
  const grade = filters.grade ?? "platinum";

  let query = supabase
    .from("partner_assets")
    .select("*, partners!inner(company_name, grade)")
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.nodeType && filters.nodeType !== "all") {
    query = query.eq("node_type", filters.nodeType);
  }

  if (filters.status && filters.status !== "all") {
    query = query.eq("asset_status", filters.status);
  }

  const { data, error } = await query;
  let rows: AssetListRow[] = (data ?? [])
    .map((row) => mapAssetRow(row))
    .filter((row) => !isSamplePartnerName(row.partner_name));

  if (grade && grade !== "all") {
    rows = rows.filter((row) => (row.partner_grade ?? "none") === grade);
  }

  if (filters.review === "only") {
    rows = rows.filter((row) => row.match_status === "review");
  }

  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter((row) =>
      [
        row.partner_name,
        row.partner_grade_label,
        row.node_name,
        row.node_type,
        row.asset_status,
        row.cpu,
        row.memory,
        row.os_disk,
        row.ceph_disk,
        row.nic,
        row.memo
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }

  return { rows, error };
}

export async function fetchAssetTypeOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("partner_assets").select("node_type, asset_type");
  return uniqueSorted(
    (data ?? []).flatMap((row) => {
      const item = row as { node_type: string | null; asset_type: string | null };
      return [item.node_type, item.asset_type].filter((value): value is string => !!value);
    })
  );
}

export async function fetchAssetStatusOptions() {
  const supabase = await createClient();
  const { data } = await supabase.from("partner_assets").select("asset_status");
  return uniqueSorted(
    (data ?? [])
      .map((row) => (row as { asset_status: string | null }).asset_status)
      .filter((value): value is string => !!value)
  );
}

function mapAssetRow(row: Record<string, unknown>): AssetListRow {
  const partners = row.partners as
    | { company_name: string; grade: string | null }
    | Array<{ company_name: string; grade: string | null }>;
  const partner = Array.isArray(partners) ? partners[0] : partners;
  const grade = partner?.grade ?? null;

  return {
    id: String(row.id),
    partner_id: String(row.partner_id),
    asset_type: (row.asset_type as string | null) ?? null,
    asset_name: (row.asset_name as string | null) ?? null,
    vendor: (row.vendor as string | null) ?? null,
    model_name: (row.model_name as string | null) ?? null,
    spec_summary: (row.spec_summary as string | null) ?? null,
    partner_name_raw: (row.partner_name_raw as string | null) ?? null,
    asset_group: (row.asset_group as string | null) ?? null,
    node_type: (row.node_type as string | null) ?? null,
    node_name: (row.node_name as string | null) ?? null,
    form_factor: (row.form_factor as string | null) ?? null,
    cpu: (row.cpu as string | null) ?? null,
    memory: (row.memory as string | null) ?? null,
    os_disk: (row.os_disk as string | null) ?? null,
    ceph_disk: (row.ceph_disk as string | null) ?? null,
    nic: (row.nic as string | null) ?? null,
    asset_status: (row.asset_status as string | null) ?? null,
    quantity: (row.quantity as number | null) ?? null,
    status: (row.status as string | null) ?? null,
    memo: (row.memo as string | null) ?? null,
    match_status: (row.match_status as string | null) ?? null,
    source_file: (row.source_file as string | null) ?? null,
    last_synced_at: (row.last_synced_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: (row.updated_at as string | null) ?? null,
    partner_name: partner?.company_name ?? "(미상)",
    partner_grade: grade,
    partner_grade_label: PARTNER_GRADE_LABEL[grade ?? "none"] ?? grade ?? "-"
  };
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) =>
    a.localeCompare(b, "ko-KR", { numeric: true })
  );
}
