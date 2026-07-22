/**
 * 공식 파트너 통계 제외 판별 단위 테스트
 * 실행: npx tsx scripts/test-official-stats-exclude.ts
 */
import {
  isExcludedFromOfficialPartnerStats,
  normalizeOfficialStatsCompanyName
} from "../src/lib/partners/official-stats-exclude";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SHOULD_EXCLUDE = [
  "투모로우넷",
  "(주)투모로우넷",
  "주식회사 투모로우넷",
  "주식회사투모로우넷",
  "㈜투모로우넷",
  "Tomorrow Net",
  "TomorrowNet"
];

const SHOULD_KEEP = ["투모로우시스템", "넷투모로우", "투모로우넷웍스"];

for (const name of SHOULD_EXCLUDE) {
  assert(
    isExcludedFromOfficialPartnerStats(name),
    `expected exclude: ${name} (norm=${normalizeOfficialStatsCompanyName(name)})`
  );
  assert(
    isExcludedFromOfficialPartnerStats({ company_name: name }),
    `expected exclude partner: ${name}`
  );
}

for (const name of SHOULD_KEEP) {
  assert(
    !isExcludedFromOfficialPartnerStats(name),
    `expected keep: ${name} (norm=${normalizeOfficialStatsCompanyName(name)})`
  );
}

assert(!isExcludedFromOfficialPartnerStats(null), "null");
assert(!isExcludedFromOfficialPartnerStats(""), "empty");
assert(!isExcludedFromOfficialPartnerStats({ company_name: "오케스트로" }), "okestro");

console.log("OK: official partner stats exclusion tests passed");
