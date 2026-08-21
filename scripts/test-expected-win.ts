import assert from "assert";
import { isExpectedWinOpportunity, isExpectedWinPartnerPipeline } from "../src/lib/performance/expected-win";
import { buildWinProbabilityBucketStats, winProbabilityBucketId } from "../src/lib/performance/win-probability-buckets";

function run() {
  assert.strictEqual(isExpectedWinOpportunity({ win_probability_label: "50%(F)" }), true);
  assert.strictEqual(isExpectedWinOpportunity({ win_probability_label: "50%(U)" }), false);
  assert.strictEqual(isExpectedWinOpportunity({ win_probability_label: "75%" }), true);
  assert.strictEqual(isExpectedWinOpportunity({ win_probability_label: "90%" }), true);
  assert.strictEqual(isExpectedWinOpportunity({ win_probability_label: "100%" }), true);
  assert.strictEqual(isExpectedWinOpportunity({ win_probability_label: "25%" }), false);
  assert.strictEqual(isExpectedWinOpportunity({ win_probability_label: "0%" }), false);
  assert.strictEqual(isExpectedWinOpportunity({ win_probability_label: "50%" }), false);

  assert.strictEqual(
    isExpectedWinPartnerPipeline({
      is_product_revenue: true,
      is_partner_deal: true,
      expected_win_year: "FY26",
      win_probability_label: "50%(U)"
    }),
    false
  );
  assert.strictEqual(
    isExpectedWinPartnerPipeline({
      is_product_revenue: true,
      is_partner_deal: true,
      expected_win_year: "FY26",
      win_probability_label: "50%(F)"
    }),
    true
  );

  assert.strictEqual(winProbabilityBucketId({ win_probability_label: "50%(U)" }), "50u");
  assert.strictEqual(winProbabilityBucketId({ win_probability_label: "50%(F)" }), "50f");
  const buckets = buildWinProbabilityBucketStats([
    { project_code: "A", product_amount_million: 1, win_probability_label: "0%" },
    { project_code: "B", product_amount_million: 2, win_probability_label: "50%(U)" },
    { project_code: "C", product_amount_million: 3, win_probability_label: "75%" }
  ]);
  assert.strictEqual(buckets.find((row) => row.label === "0%")?.count, 1);
  assert.strictEqual(buckets.find((row) => row.label === "25%")?.count, 0);
  assert.strictEqual(buckets.find((row) => row.label === "50%(U)")?.count, 1);
  assert.strictEqual(buckets.find((row) => row.label === "75%")?.count, 1);

  console.log("expected-win tests ok");
}

run();
