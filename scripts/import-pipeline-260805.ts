/**
 * 260805 인벤토리 rawdata를 current snapshot으로 저장.
 * 이전 snapshot / 2025 매출은 유지한다.
 *
 * 실행: npx tsx scripts/import-pipeline-260805.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { parsePartnerPerformanceWorkbook } from "../src/lib/excel/parse-partner-performance";
import { analyzePartnerPerformanceUpload } from "../src/lib/imports/partner-performance";
import { getPerformanceNameKeys } from "../src/lib/partners/performance-match";
import {
  refreshPipelineCurrentSnapshot,
  resolvePipelineSnapshotSaveTarget
} from "../src/lib/performance/snapshot-persistence";
import { createAdminClient } from "../src/lib/supabase/admin";
import { isUnknownPartnerName } from "../src/lib/partners/performance-match";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    throw new Error(".env.local을 읽을 수 없습니다.");
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function upsertNtsAlias(
  supabase: ReturnType<typeof createAdminClient>,
  partners: Array<{ id: string; company_name: string }>
) {
  const ants = partners.find((p) => p.company_name.replace(/\s+/g, "") === "앤티에스");
  if (!ants) {
    console.warn("파트너 DB에서 '앤티에스'를 찾지 못해 alias를 저장하지 않습니다.");
    return;
  }

  const aliasName = "엔티에스";
  const keys = getPerformanceNameKeys(aliasName);
  for (const key of keys) {
    const { error } = await supabase.from("partner_aliases").upsert(
      {
        partner_id: ants.id,
        alias_name: aliasName,
        normalized_alias: key,
        source: "pipeline_260805",
        updated_at: new Date().toISOString()
      },
      { onConflict: "normalized_alias" }
    );
    if (error) throw new Error(`엔티에스 alias 저장 실패: ${error.message}`);
  }
  console.log(`alias saved: 엔티에스 → ${ants.company_name} (${ants.id})`);
}

async function main() {
  loadEnvLocal();
  const filePath = resolve(process.cwd(), "tmp-pipeline-260805.xlsx");
  const fileName = "2026년 오케스트로 파트너 관리_260805.xlsx";
  const workbook = XLSX.read(readFileSync(filePath), { type: "buffer", cellDates: true });
  const parsed = parsePartnerPerformanceWorkbook(workbook, fileName);
  if (parsed.parse_errors.length > 0 || !parsed.required_columns_found || !parsed.snapshot_date) {
    throw new Error(parsed.parse_errors.join(" / ") || "파싱 실패");
  }

  const supabase = createAdminClient();
  const [{ data: partners, error: partnersError }, { data: aliases, error: aliasesError }] =
    await Promise.all([
      supabase.from("partners").select("id, company_name, business_number").is("deleted_at", null),
      supabase.from("partner_aliases").select("partner_id, alias_name, normalized_alias")
    ]);
  if (partnersError) throw new Error(partnersError.message);
  if (aliasesError) throw new Error(aliasesError.message);

  const partnerRows = (partners ?? []).map((p) => ({
    id: String(p.id),
    company_name: String(p.company_name),
    business_number: p.business_number ? String(p.business_number) : null
  }));

  await upsertNtsAlias(supabase, partnerRows);

  const { data: aliasesAfter } = await supabase
    .from("partner_aliases")
    .select("partner_id, alias_name, normalized_alias");

  const analysis = analyzePartnerPerformanceUpload({
    inventory_rows: parsed.inventory_rows,
    revenue_rows: parsed.revenue_rows,
    snapshot_date: parsed.snapshot_date,
    snapshot_label: parsed.snapshot_label,
    summary_validation: {
      win_forecast_partner_amount_million: null,
      win_forecast_partner_count: null,
      new_reg_partner_amount_million: null,
      new_reg_partner_count: null
    },
    partners: partnerRows,
    aliases: (aliasesAfter ?? aliases ?? []).map((a) => ({
      partner_id: String(a.partner_id),
      alias_name: String(a.alias_name),
      normalized_alias: String(a.normalized_alias)
    })),
    required_columns_found: parsed.required_columns_found,
    parse_errors: parsed.parse_errors
  });

  if (!analysis.summary.can_save) {
    throw new Error(analysis.summary.save_blockers.join(" / "));
  }

  console.log("parse summary", {
    snapshot_date: analysis.summary.snapshot_date,
    snapshot_label: analysis.summary.snapshot_label,
    inventory_row_count: analysis.summary.inventory_row_count,
    all_opportunity: `${analysis.summary.win_forecast_partner_count} / ${analysis.summary.win_forecast_partner_amount_million}`,
    expected_win: `${analysis.summary.expected_win_partner_count} / ${analysis.summary.expected_win_partner_amount_million}`,
    warnings: analysis.summary.validation_warnings
  });

  const { snapshotId, snapshotAction, version } = await resolvePipelineSnapshotSaveTarget(supabase, {
    snapshot_date: parsed.snapshot_date,
    snapshot_label: parsed.snapshot_label ?? "260805",
    source_file_name: fileName,
    duplicate_mode: "new_version",
    summary: {
      total_pipeline_amount_million: analysis.summary.win_forecast_total_amount_million,
      total_pipeline_count: analysis.summary.win_forecast_total_count,
      partner_pipeline_amount_million: analysis.summary.win_forecast_partner_amount_million,
      partner_pipeline_count: analysis.summary.win_forecast_partner_count,
      new_total_pipeline_amount_million: analysis.summary.new_reg_total_amount_million,
      new_total_pipeline_count: analysis.summary.new_reg_total_count,
      new_partner_pipeline_amount_million: analysis.summary.new_reg_partner_amount_million,
      new_partner_pipeline_count: analysis.summary.new_reg_partner_count
    }
  });

  const now = new Date().toISOString();
  const payloads = analysis.inventory_rows
    .filter((row) => row.project_code?.trim())
    .map((row) => ({
      snapshot_id: snapshotId,
      snapshot_date: parsed.snapshot_date,
      project_code: row.project_code.trim(),
      customer_name: row.customer_name ?? null,
      project_name: row.project_name ?? null,
      project_registered_year: row.project_registered_year ?? null,
      sales_owner: row.sales_owner ?? null,
      division: row.division ?? null,
      company: row.company ?? null,
      org_path: row.org_path ?? null,
      expected_win_year: row.expected_win_year ?? null,
      expected_win_quarter: row.expected_win_quarter ?? null,
      expected_win_month: row.expected_win_month ?? null,
      importance: row.importance ?? null,
      rfp_reflection: row.rfp_reflection ?? null,
      win_probability_label: row.win_probability_label ?? null,
      win_probability_value: row.win_probability_value ?? null,
      win_status: row.win_status ?? null,
      execution_status: row.execution_status ?? null,
      participation_type: row.participation_type ?? null,
      contract_owner: row.contract_owner ?? null,
      expected_contract_partner: row.expected_contract_partner ?? null,
      is_partner_deal: row.is_partner_deal,
      partner_grade: row.partner_grade ?? null,
      partner_name: row.partner_name ?? null,
      raw_partner_name: row.raw_partner_name ?? row.partner_name ?? null,
      matched_partner_id: row.matched_partner_id ?? null,
      matched_partner_name: row.matched_partner_name ?? null,
      match_status: row.matched_partner_id
        ? "matched"
        : isUnknownPartnerName(row.raw_partner_name ?? row.partner_name)
          ? "unknown_partner"
          : row.match_status === "review"
            ? "review_needed"
            : "unmatched",
      match_reason: row.match_reason ?? null,
      is_product_revenue: row.is_product_revenue,
      contract_type: row.contract_type ?? null,
      product_amount_million: row.product_amount_million ?? null,
      service_amount_million: row.service_amount_million ?? null,
      maintenance_amount_million: row.maintenance_amount_million ?? null,
      total_amount_million: row.total_amount_million ?? null,
      product_contrabass: row.product_contrabass ?? null,
      product_contrabass_hci: row.product_contrabass_hci ?? null,
      product_contrabass_legato: row.product_contrabass_legato ?? null,
      product_viola: row.product_viola ?? null,
      product_cmp: row.product_cmp ?? null,
      product_trombone: row.product_trombone ?? null,
      product_trumpet: row.product_trumpet ?? null,
      product_symphony_ai: row.product_symphony_ai ?? null,
      product_tuba: row.product_tuba ?? null,
      product_gaidsp: row.product_gaidsp ?? null,
      raw_json: row.raw_json ?? null,
      updated_at: now
    }));

  let created = 0;
  for (const batch of chunk(payloads, 200)) {
    const { error } = await supabase.from("partner_pipeline_opportunities").insert(batch);
    if (error) throw new Error(error.message);
    created += batch.length;
  }

  const currentSnapshotId = await refreshPipelineCurrentSnapshot(supabase);

  const fy26 = analysis.inventory_rows.filter(
    (row) => row.is_partner_deal && row.is_product_revenue && String(row.expected_win_year ?? "").toUpperCase() === "FY26"
  );
  const unmatchedNames = new Map<string, number>();
  const reviewNames = new Map<string, number>();
  for (const row of fy26) {
    const name = row.raw_partner_name ?? row.partner_name ?? "(empty)";
    if (row.matched_partner_id) continue;
    if (isUnknownPartnerName(name)) {
      unmatchedNames.set(name, (unmatchedNames.get(name) ?? 0) + 1);
      continue;
    }
    reviewNames.set(name, (reviewNames.get(name) ?? 0) + 1);
  }

  const nts = fy26.filter((row) => /엔티에스|앤티에스/.test(String(row.partner_name ?? "")));

  console.log("saved", {
    snapshotId,
    snapshotAction,
    version,
    created,
    is_current: currentSnapshotId === snapshotId,
    nts: nts.map((row) => ({
      raw: row.partner_name,
      matched: row.matched_partner_name,
      status: row.match_status,
      code: row.project_code
    })),
    unmatched: [...unmatchedNames.entries()],
    review: [...reviewNames.entries()]
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
