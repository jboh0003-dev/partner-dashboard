import { createClient } from "@/lib/supabase/server";
import { isFy26, isRegisteredYear2026 } from "@/lib/performance/format";
import type {
  ExecutivePerformanceStats,
  PartnerPerformanceSnapshot,
  PartnerPipelineOpportunity,
  PartnerRevenueRecord
} from "@/types/partner-performance";

function mapSnapshot(row: Record<string, unknown>): PartnerPerformanceSnapshot {
  return {
    id: String(row.id),
    snapshot_date: String(row.snapshot_date),
    snapshot_label: String(row.snapshot_label),
    source_file_name: String(row.source_file_name),
    total_pipeline_amount_million: Number(row.total_pipeline_amount_million ?? 0),
    total_pipeline_count: Number(row.total_pipeline_count ?? 0),
    partner_pipeline_amount_million: Number(row.partner_pipeline_amount_million ?? 0),
    partner_pipeline_count: Number(row.partner_pipeline_count ?? 0),
    new_total_pipeline_amount_million: Number(row.new_total_pipeline_amount_million ?? 0),
    new_total_pipeline_count: Number(row.new_total_pipeline_count ?? 0),
    new_partner_pipeline_amount_million: Number(row.new_partner_pipeline_amount_million ?? 0),
    new_partner_pipeline_count: Number(row.new_partner_pipeline_count ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function mapOpportunity(row: Record<string, unknown>): PartnerPipelineOpportunity {
  return {
    id: String(row.id),
    snapshot_id: String(row.snapshot_id),
    snapshot_date: String(row.snapshot_date),
    project_code: String(row.project_code),
    customer_name: row.customer_name ? String(row.customer_name) : null,
    project_name: row.project_name ? String(row.project_name) : null,
    project_registered_year: row.project_registered_year ? String(row.project_registered_year) : null,
    sales_owner: row.sales_owner ? String(row.sales_owner) : null,
    division: row.division ? String(row.division) : null,
    company: row.company ? String(row.company) : null,
    org_path: row.org_path ? String(row.org_path) : null,
    expected_win_year: row.expected_win_year ? String(row.expected_win_year) : null,
    expected_win_quarter: row.expected_win_quarter ? String(row.expected_win_quarter) : null,
    expected_win_month: row.expected_win_month ? String(row.expected_win_month) : null,
    importance: row.importance ? String(row.importance) : null,
    rfp_reflection: row.rfp_reflection ? String(row.rfp_reflection) : null,
    win_probability_label: row.win_probability_label ? String(row.win_probability_label) : null,
    win_probability_value: row.win_probability_value != null ? Number(row.win_probability_value) : null,
    win_status: row.win_status ? String(row.win_status) : null,
    execution_status: row.execution_status ? String(row.execution_status) : null,
    participation_type: row.participation_type ? String(row.participation_type) : null,
    contract_owner: row.contract_owner ? String(row.contract_owner) : null,
    expected_contract_partner: row.expected_contract_partner
      ? String(row.expected_contract_partner)
      : null,
    is_partner_deal: Boolean(row.is_partner_deal),
    partner_grade: row.partner_grade ? String(row.partner_grade) : null,
    partner_name: row.partner_name ? String(row.partner_name) : null,
    matched_partner_id: row.matched_partner_id ? String(row.matched_partner_id) : null,
    is_product_revenue: Boolean(row.is_product_revenue),
    contract_type: row.contract_type ? String(row.contract_type) : null,
    product_amount_million:
      row.product_amount_million != null ? Number(row.product_amount_million) : null,
    service_amount_million:
      row.service_amount_million != null ? Number(row.service_amount_million) : null,
    maintenance_amount_million:
      row.maintenance_amount_million != null ? Number(row.maintenance_amount_million) : null,
    total_amount_million:
      row.total_amount_million != null ? Number(row.total_amount_million) : null,
    product_contrabass: row.product_contrabass != null ? Number(row.product_contrabass) : null,
    product_contrabass_hci:
      row.product_contrabass_hci != null ? Number(row.product_contrabass_hci) : null,
    product_contrabass_legato:
      row.product_contrabass_legato != null ? Number(row.product_contrabass_legato) : null,
    product_viola: row.product_viola != null ? Number(row.product_viola) : null,
    product_cmp: row.product_cmp != null ? Number(row.product_cmp) : null,
    product_trombone: row.product_trombone != null ? Number(row.product_trombone) : null,
    product_trumpet: row.product_trumpet != null ? Number(row.product_trumpet) : null,
    product_symphony_ai:
      row.product_symphony_ai != null ? Number(row.product_symphony_ai) : null,
    product_tuba: row.product_tuba != null ? Number(row.product_tuba) : null,
    product_gaidsp: row.product_gaidsp != null ? Number(row.product_gaidsp) : null,
    raw_json: (row.raw_json as Record<string, unknown> | null) ?? null
  };
}

function aggregateByPartner(
  rows: PartnerPipelineOpportunity[],
  filter: (row: PartnerPipelineOpportunity) => boolean
) {
  const map = new Map<
    string,
    {
      partner_name: string;
      matched_partner_id: string | null;
      partner_grade: string | null;
      amount: number;
      codes: Set<string>;
      customers: Set<string>;
      projects: Set<string>;
    }
  >();

  for (const row of rows) {
    if (!filter(row) || !row.partner_name?.trim()) continue;
    const key = row.matched_partner_id ?? row.partner_name.trim();
    const entry = map.get(key) ?? {
      partner_name: row.partner_name.trim(),
      matched_partner_id: row.matched_partner_id,
      partner_grade: row.partner_grade,
      amount: 0,
      codes: new Set<string>(),
      customers: new Set<string>(),
      projects: new Set<string>()
    };
    entry.amount += row.product_amount_million ?? 0;
    if (row.project_code) entry.codes.add(row.project_code);
    if (row.customer_name) entry.customers.add(row.customer_name);
    if (row.project_name) entry.projects.add(row.project_name);
    if (!entry.partner_grade && row.partner_grade) entry.partner_grade = row.partner_grade;
    map.set(key, entry);
  }

  return Array.from(map.values())
    .map((entry) => ({
      partner_name: entry.partner_name,
      matched_partner_id: entry.matched_partner_id,
      partner_grade: entry.partner_grade,
      amount_million: Math.round(entry.amount),
      project_count: entry.codes.size,
      top_customers: Array.from(entry.customers).slice(0, 3),
      top_projects: Array.from(entry.projects).slice(0, 3)
    }))
    .sort((a, b) => b.amount_million - a.amount_million);
}

function aggregateBreakdown(
  rows: PartnerPipelineOpportunity[],
  keyFn: (row: PartnerPipelineOpportunity) => string | null
) {
  const map = new Map<string, { amount: number; count: number; codes: Set<string> }>();
  for (const row of rows) {
    if (!row.is_product_revenue || !row.is_partner_deal) continue;
    const key = keyFn(row)?.trim() || "미정";
    const entry = map.get(key) ?? { amount: 0, count: 0, codes: new Set<string>() };
    entry.amount += row.product_amount_million ?? 0;
    if (row.project_code) entry.codes.add(row.project_code);
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([label, entry]) => ({
      label,
      amount_million: Math.round(entry.amount),
      count: entry.codes.size
    }))
    .sort((a, b) => b.amount_million - a.amount_million);
}

function isWinForecastPipelineRow(row: PartnerPipelineOpportunity): boolean {
  return row.is_product_revenue && row.is_partner_deal && isFy26(row.expected_win_year);
}

function isNewRegPipelineRow(row: PartnerPipelineOpportunity): boolean {
  return (
    row.is_product_revenue &&
    row.is_partner_deal &&
    isRegisteredYear2026(row.project_registered_year)
  );
}

export async function fetchLatestSnapshots(limit = 12): Promise<PartnerPerformanceSnapshot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_performance_snapshots")
    .select("*")
    .order("snapshot_date", { ascending: true })
    .limit(limit);
  return (data ?? []).map((row) => mapSnapshot(row as Record<string, unknown>));
}

export async function fetchExecutivePerformanceStats(): Promise<ExecutivePerformanceStats> {
  const supabase = await createClient();
  const snapshots = await fetchLatestSnapshots(20);
  const latest = snapshots.at(-1) ?? null;
  const previous = snapshots.length > 1 ? snapshots.at(-2)! : null;

  if (!latest) {
    return {
      latest_snapshot: null,
      previous_snapshot: null,
      snapshot_trend: [],
      win_forecast_top10: [],
      new_reg_top10: [],
      revenue_top10: [],
      win_probability_breakdown: [],
      division_breakdown: [],
      grade_breakdown: [],
      review_count: 0,
      unmatched_partner_count: 0
    };
  }

  const [{ data: opportunities }, { data: revenueRows }] = await Promise.all([
    supabase
      .from("partner_pipeline_opportunities")
      .select("*")
      .eq("snapshot_id", latest.id),
    supabase
      .from("partner_revenue_records")
      .select("*")
      .eq("revenue_year", 2025)
      .order("product_revenue_million", { ascending: false })
      .limit(200)
  ]);

  const rows = (opportunities ?? []).map((row) =>
    mapOpportunity(row as Record<string, unknown>)
  );

  const winFilter = isWinForecastPipelineRow;
  const newFilter = isNewRegPipelineRow;

  const revenue_top10 = Array.from(
    (revenueRows ?? []).reduce<
      Map<
        string,
        {
          partner_name: string;
          matched_partner_id: string | null;
          partner_grade: string | null;
          amount: number;
          count: number;
        }
      >
    >((map, row) => {
      const record = row as PartnerRevenueRecord;
      const key = record.matched_partner_id ?? record.partner_name;
      const entry = map.get(key) ?? {
        partner_name: record.partner_name,
        matched_partner_id: record.matched_partner_id,
        partner_grade: record.partner_grade,
        amount: 0,
        count: 0
      };
      entry.amount += Number(record.product_revenue_million ?? 0);
      entry.count += Number(record.project_count ?? 1);
      map.set(key, entry);
      return map;
    }, new Map()).values()
  )
    .map((row) => ({
      partner_name: row.partner_name,
      matched_partner_id: row.matched_partner_id,
      partner_grade: row.partner_grade,
      product_revenue_million: Math.round(row.amount),
      project_count: row.count
    }))
    .sort((a, b) => b.product_revenue_million - a.product_revenue_million)
    .slice(0, 10);

  const partnerDealRows = rows.filter((row) => row.is_partner_deal && row.is_product_revenue);
  const unmatched_partner_count = new Set(
    partnerDealRows.filter((row) => !row.matched_partner_id && row.partner_name).map((r) => r.partner_name)
  ).size;

  return {
    latest_snapshot: latest,
    previous_snapshot: previous,
    snapshot_trend: snapshots.map((snapshot) => ({
      snapshot_label: snapshot.snapshot_label,
      snapshot_date: snapshot.snapshot_date,
      partner_pipeline_amount_million: snapshot.partner_pipeline_amount_million ?? 0,
      partner_pipeline_count: snapshot.partner_pipeline_count ?? 0,
      new_partner_pipeline_amount_million: snapshot.new_partner_pipeline_amount_million ?? 0,
      new_partner_pipeline_count: snapshot.new_partner_pipeline_count ?? 0
    })),
    win_forecast_top10: aggregateByPartner(rows, winFilter).slice(0, 10),
    new_reg_top10: aggregateByPartner(rows, newFilter).slice(0, 10),
    revenue_top10,
    win_probability_breakdown: aggregateBreakdown(
      partnerDealRows.filter(winFilter),
      (row) => row.win_probability_label
    ),
    division_breakdown: aggregateBreakdown(
      partnerDealRows.filter(winFilter),
      (row) => row.division
    ),
    grade_breakdown: aggregateBreakdown(
      partnerDealRows.filter(winFilter),
      (row) => row.partner_grade
    ),
    review_count:
      partnerDealRows.filter((row) => !row.matched_partner_id && row.partner_name).length +
      partnerDealRows.filter((row) => !row.project_code?.trim()).length,
    unmatched_partner_count
  };
}

export async function fetchPartnerPerformanceBundle(partnerId: string) {
  const supabase = await createClient();
  const snapshots = await fetchLatestSnapshots(1);
  const latest = snapshots.at(-1);
  if (!latest) {
    return {
      snapshot: null,
      win_forecast_amount_million: 0,
      win_forecast_count: 0,
      new_reg_amount_million: 0,
      new_reg_count: 0,
      revenue_amount_million: 0,
      revenue_count: 0,
      opportunities: [] as PartnerPipelineOpportunity[],
      win_probability_breakdown: [] as Array<{ label: string; amount_million: number; count: number }>
    };
  }

  const [{ data: opportunities }, { data: revenueRows }] = await Promise.all([
    supabase
      .from("partner_pipeline_opportunities")
      .select("*")
      .eq("snapshot_id", latest.id)
      .eq("matched_partner_id", partnerId),
    supabase
      .from("partner_revenue_records")
      .select("*")
      .eq("matched_partner_id", partnerId)
      .eq("revenue_year", 2025)
  ]);

  const rows = (opportunities ?? []).map((row) =>
    mapOpportunity(row as Record<string, unknown>)
  );

  const winRows = rows.filter(isWinForecastPipelineRow);
  const newRows = rows.filter(isNewRegPipelineRow);

  const revenue_amount_million = (revenueRows ?? []).reduce(
    (sum, row) => sum + Number((row as PartnerRevenueRecord).product_revenue_million ?? 0),
    0
  );

  return {
    snapshot: latest,
    win_forecast_amount_million: Math.round(
      winRows.reduce((sum, row) => sum + (row.product_amount_million ?? 0), 0)
    ),
    win_forecast_count: new Set(winRows.map((row) => row.project_code)).size,
    new_reg_amount_million: Math.round(
      newRows.reduce((sum, row) => sum + (row.product_amount_million ?? 0), 0)
    ),
    new_reg_count: new Set(newRows.map((row) => row.project_code)).size,
    revenue_amount_million: Math.round(revenue_amount_million),
    revenue_count: (revenueRows ?? []).length,
    opportunities: rows,
    win_probability_breakdown: aggregateBreakdown(winRows, (row) => row.win_probability_label)
  };
}

export async function fetchPerformanceOpportunities(snapshotId?: string) {
  const supabase = await createClient();
  let targetSnapshotId = snapshotId;
  if (!targetSnapshotId) {
    const snapshots = await fetchLatestSnapshots(1);
    targetSnapshotId = snapshots.at(-1)?.id;
  }
  if (!targetSnapshotId) return { snapshot: null, opportunities: [] as PartnerPipelineOpportunity[] };

  const [{ data: snapshot }, { data: opportunities }] = await Promise.all([
    supabase.from("partner_performance_snapshots").select("*").eq("id", targetSnapshotId).single(),
    supabase
      .from("partner_pipeline_opportunities")
      .select("*")
      .eq("snapshot_id", targetSnapshotId)
      .order("product_amount_million", { ascending: false })
      .limit(5000)
  ]);

  return {
    snapshot: snapshot ? mapSnapshot(snapshot as Record<string, unknown>) : null,
    opportunities: (opportunities ?? []).map((row) =>
      mapOpportunity(row as Record<string, unknown>)
    )
  };
}
