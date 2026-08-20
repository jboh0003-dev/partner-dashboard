import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import {
  isWinForecastPartnerPipeline,
  parsePartnerPerformanceWorkbook,
  uniqueProjectCount,
  sumProductAmount
} from "../src/lib/excel/parse-partner-performance";
import { isExpectedWinOpportunity } from "../src/lib/performance/expected-win";

const filePath = path.join(process.cwd(), "tmp-pipeline-260805.xlsx");
const buf = fs.readFileSync(filePath);
const workbook = XLSX.read(buf, { type: "buffer", cellDates: true });
console.log("sheets:", workbook.SheetNames);

const parsed = parsePartnerPerformanceWorkbook(workbook, "2026년 오케스트로 파트너 관리_260805.xlsx");
console.log({
  inventory_sheet_name: parsed.inventory_sheet_name,
  snapshot_label: parsed.snapshot_label,
  snapshot_date: parsed.snapshot_date,
  required_columns_found: parsed.required_columns_found,
  parse_errors: parsed.parse_errors,
  inventory_rows: parsed.inventory_rows.length,
  revenue_rows: parsed.revenue_rows.length
});

const fy26Partner = parsed.inventory_rows.filter(isWinForecastPartnerPipeline);
const labels = new Map<string, { count: Set<string>; amount: number }>();
for (const row of fy26Partner) {
  const label = row.win_probability_label ?? "(empty)";
  const entry = labels.get(label) ?? { count: new Set<string>(), amount: 0 };
  if (row.project_code) entry.count.add(row.project_code);
  entry.amount += row.product_amount_million ?? 0;
  labels.set(label, entry);
}

console.log("FY26 partner unique", uniqueProjectCount(fy26Partner), "amount", sumProductAmount(fy26Partner));
console.log("labels:");
for (const [label, entry] of [...labels.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`  ${label}: ${entry.count.size} / ${entry.amount}`);
}

const expected = fy26Partner.filter(isExpectedWinOpportunity);
console.log("expected F-set", uniqueProjectCount(expected), "amount", sumProductAmount(expected));
console.log("sample partners", [...new Set(fy26Partner.map((r) => r.partner_name).filter(Boolean))].slice(0, 40));
const nts = fy26Partner.filter((r) => /엔티에스|앤티에스/.test(String(r.partner_name ?? "")));
console.log("nts rows", nts.map((r) => ({ partner: r.partner_name, code: r.project_code, label: r.win_probability_label })));
