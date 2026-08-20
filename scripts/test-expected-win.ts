import assert from "assert";
import { isExpectedWinOpportunity, isExpectedWinPartnerPipeline } from "../src/lib/performance/expected-win";

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

  console.log("expected-win tests ok");
}

run();
