import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createAdminClient } from "../src/lib/supabase/admin";
import { isExpectedWinPartnerPipeline } from "../src/lib/performance/expected-win";
import { isFy26 } from "../src/lib/performance/format";

function loadEnvLocal() {
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
}

async function main() {
  loadEnvLocal();
  const supabase = createAdminClient();
  const { data: snapshot } = await supabase
    .from("partner_performance_snapshots")
    .select("id, snapshot_date, snapshot_label, is_current, partner_pipeline_count, partner_pipeline_amount_million")
    .eq("is_current", true)
    .maybeSingle();
  let rows: Array<Record<string, unknown>> = [];
  for (const from of [0, 1000, 2000]) {
    const { data, error } = await supabase
      .from("partner_pipeline_opportunities")
      .select(
        "project_code, win_probability_label, is_partner_deal, is_product_revenue, expected_win_year, product_amount_million, partner_name, matched_partner_name"
      )
      .eq("snapshot_id", snapshot!.id)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows = rows.concat(data ?? []);
    if ((data ?? []).length < 1000) break;
  }
  console.log("rows fetched", rows.length);

  const fy26 = rows.filter(
    (row) =>
      Boolean(row.is_partner_deal) &&
      Boolean(row.is_product_revenue) &&
      isFy26(row.expected_win_year as string | null)
  );
  const unique = new Set(fy26.map((r) => r.project_code));
  const amount = fy26.reduce((s, r) => s + Number(r.product_amount_million ?? 0), 0);
  const expected = fy26.filter(isExpectedWinPartnerPipeline);
  const expectedUnique = new Set(expected.map((r) => r.project_code));
  const expectedAmount = expected.reduce((s, r) => s + Number(r.product_amount_million ?? 0), 0);
  const hasU = expected.some((r) => String(r.win_probability_label).includes("50%(U)"));
  const hasZeroInAll = fy26.some((r) => String(r.win_probability_label).startsWith("0"));
  const hasZeroInExpected = expected.some((r) => String(r.win_probability_label).startsWith("0"));
  console.log({
    fy26Count: unique.size,
    fy26Amount: amount,
    expectedCount: expectedUnique.size,
    expectedAmount,
    hasU,
    hasZeroInAll,
    hasZeroInExpected
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
