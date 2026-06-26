import type { ParsedInventoryRow, ParsedRevenueRow } from "@/lib/excel/parse-partner-performance";
import {
  isNewRegPartnerPipeline,
  isNewRegTotalPipeline,
  isWinForecastPartnerPipeline,
  isWinForecastTotalPipeline,
  sumProductAmount,
  uniqueProjectCount
} from "@/lib/excel/parse-partner-performance";
import { companyNamesMatchWithVariants } from "@/lib/documents/partner-aliases";
import {
  getExactCompanyNameKey,
  normalizeCompanyName
} from "@/lib/partner-match";
import { REFERENCE_VALIDATION } from "@/lib/performance/constants";
import { formatMillion } from "@/lib/performance/format";
import type { PipelinePartnerAggregate } from "@/types/partner-performance";

export type PartnerPerformancePartnerRow = {
  id: string;
  company_name: string;
};

export type MatchedInventoryRow = ParsedInventoryRow & {
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  match_status: "matched" | "review";
  match_reason: string | null;
};

export type MatchedRevenueRow = ParsedRevenueRow & {
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  match_status: "matched" | "review";
  match_reason: string | null;
};

export type PartnerPerformanceAnalysisSummary = {
  snapshot_date: string | null;
  snapshot_label: string | null;
  inventory_row_count: number;
  win_forecast_partner_amount_million: number;
  win_forecast_partner_count: number;
  win_forecast_total_amount_million: number;
  win_forecast_total_count: number;
  new_reg_partner_amount_million: number;
  new_reg_partner_count: number;
  new_reg_total_amount_million: number;
  new_reg_total_count: number;
  revenue_partner_amount_million: number;
  revenue_partner_count: number;
  partner_match_matched: number;
  partner_match_review: number;
  validation_warnings: string[];
  can_save: boolean;
  save_blockers: string[];
};

export type PartnerPerformanceAnalysisResult = {
  summary: PartnerPerformanceAnalysisSummary;
  inventory_rows: MatchedInventoryRow[];
  revenue_rows: MatchedRevenueRow[];
  win_forecast_top10: PipelinePartnerAggregate[];
  new_reg_top10: PipelinePartnerAggregate[];
  revenue_top10: Array<{
    partner_name: string;
    matched_partner_id: string | null;
    partner_grade: string | null;
    product_revenue_million: number;
    project_count: number;
  }>;
};

function matchPartnerName(
  partnerName: string | null | undefined,
  partners: PartnerPerformancePartnerRow[]
): {
  partner: PartnerPerformancePartnerRow | null;
  reason: string | null;
} {
  if (!partnerName?.trim()) {
    return { partner: null, reason: "파트너명 없음" };
  }

  const exact = partners.filter(
    (p) => p.company_name.trim().toLowerCase() === partnerName.trim().toLowerCase()
  );
  if (exact.length === 1) return { partner: exact[0]!, reason: null };
  if (exact.length > 1) return { partner: null, reason: "동일 파트너사명이 여러 건입니다." };

  const variantMatches = partners.filter((p) =>
    companyNamesMatchWithVariants(partnerName, p.company_name)
  );
  if (variantMatches.length === 1) return { partner: variantMatches[0]!, reason: null };
  if (variantMatches.length > 1) {
    return { partner: null, reason: "유사 파트너사명이 여러 건입니다." };
  }

  const normalized = normalizeCompanyName(partnerName);
  const normalizedMatches = partners.filter(
    (p) => normalizeCompanyName(p.company_name) === normalized
  );
  if (normalizedMatches.length === 1) return { partner: normalizedMatches[0]!, reason: null };
  if (normalizedMatches.length > 1) {
    return { partner: null, reason: "정규화 파트너사명이 여러 건입니다." };
  }

  const exactKey = getExactCompanyNameKey(partnerName);
  const includes = partners.filter((p) => {
    const key = getExactCompanyNameKey(p.company_name);
    return key && exactKey && (key.includes(exactKey) || exactKey.includes(key));
  });
  if (includes.length === 1) return { partner: includes[0]!, reason: null };
  if (includes.length > 1) {
    return { partner: null, reason: "포함 검색 파트너 후보가 여러 건입니다." };
  }

  return { partner: null, reason: "등록된 파트너사를 찾지 못했습니다." };
}

function buildPartnerTop10(
  rows: ParsedInventoryRow[],
  filterFn: (row: ParsedInventoryRow) => boolean
): PipelinePartnerAggregate[] {
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
    if (!filterFn(row) || !row.partner_name?.trim()) continue;
    const key = row.partner_name.trim();
    const entry =
      map.get(key) ??
      ({
        partner_name: key,
        matched_partner_id: null,
        partner_grade: row.partner_grade,
        amount: 0,
        codes: new Set<string>(),
        customers: new Set<string>(),
        projects: new Set<string>()
      } as const);

    const mutable = map.get(key) ?? {
      partner_name: key,
      matched_partner_id: null,
      partner_grade: row.partner_grade,
      amount: 0,
      codes: new Set<string>(),
      customers: new Set<string>(),
      projects: new Set<string>()
    };

    mutable.amount += row.product_amount_million ?? 0;
    if (row.project_code) mutable.codes.add(row.project_code);
    if (row.customer_name) mutable.customers.add(row.customer_name);
    if (row.project_name) mutable.projects.add(row.project_name);
    if (!mutable.partner_grade && row.partner_grade) mutable.partner_grade = row.partner_grade;
    map.set(key, mutable);
    void entry;
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
    .sort((a, b) => b.amount_million - a.amount_million)
    .slice(0, 10);
}

function compareValidation(
  actual: number,
  reference: number,
  label: string,
  warnings: string[]
): void {
  if (actual <= 0) return;
  const diffRatio = Math.abs(actual - reference) / reference;
  if (diffRatio > 0.15) {
    warnings.push(
      `${label}: rawdata ${formatMillion(actual)} vs summary 참고 ${formatMillion(reference)} (차이 ${Math.round(diffRatio * 100)}%)`
    );
  }
}

export function analyzePartnerPerformanceUpload(input: {
  inventory_rows: ParsedInventoryRow[];
  revenue_rows: ParsedRevenueRow[];
  snapshot_date: string | null;
  snapshot_label: string | null;
  summary_validation: {
    win_forecast_partner_amount_million: number | null;
    win_forecast_partner_count: number | null;
    new_reg_partner_amount_million: number | null;
    new_reg_partner_count: number | null;
  };
  partners: PartnerPerformancePartnerRow[];
  required_columns_found: boolean;
  parse_errors: string[];
}): PartnerPerformanceAnalysisResult {
  const winForecastPartnerRows = input.inventory_rows.filter(isWinForecastPartnerPipeline);
  const winForecastTotalRows = input.inventory_rows.filter(isWinForecastTotalPipeline);
  const newRegPartnerRows = input.inventory_rows.filter(isNewRegPartnerPipeline);
  const newRegTotalRows = input.inventory_rows.filter(isNewRegTotalPipeline);

  const inventory_rows: MatchedInventoryRow[] = input.inventory_rows.map((row) => {
    const match = matchPartnerName(row.partner_name, input.partners);
    return {
      ...row,
      matched_partner_id: match.partner?.id ?? null,
      matched_partner_name: match.partner?.company_name ?? null,
      match_status: match.partner ? "matched" : "review",
      match_reason: match.reason
    };
  });

  const revenue_rows: MatchedRevenueRow[] = input.revenue_rows.map((row) => {
    const match = matchPartnerName(row.partner_name, input.partners);
    return {
      ...row,
      matched_partner_id: match.partner?.id ?? null,
      matched_partner_name: match.partner?.company_name ?? null,
      match_status: match.partner ? "matched" : "review",
      match_reason: match.reason
    };
  });

  const partnerRowsWithName = inventory_rows.filter((row) => row.partner_name?.trim());
  const partner_match_matched = partnerRowsWithName.filter((row) => row.matched_partner_id).length;
  const partner_match_review = partnerRowsWithName.length - partner_match_matched;

  const validation_warnings: string[] = [];
  const win_forecast_partner_amount_million = Math.round(sumProductAmount(winForecastPartnerRows));
  const win_forecast_partner_count = uniqueProjectCount(winForecastPartnerRows);
  const new_reg_partner_amount_million = Math.round(sumProductAmount(newRegPartnerRows));
  const new_reg_partner_count = uniqueProjectCount(newRegPartnerRows);

  compareValidation(
    win_forecast_partner_amount_million,
    REFERENCE_VALIDATION.win_forecast_partner_amount_million,
    "2026 수주예상 파트너 파이프라인",
    validation_warnings
  );
  compareValidation(
    new_reg_partner_amount_million,
    REFERENCE_VALIDATION.new_reg_partner_amount_million,
    "2026 신규등록 파트너 파이프라인",
    validation_warnings
  );

  if (input.summary_validation.win_forecast_partner_amount_million != null) {
    compareValidation(
      win_forecast_partner_amount_million,
      input.summary_validation.win_forecast_partner_amount_million,
      "summary 시트 수주예상 파트너",
      validation_warnings
    );
  }
  if (input.summary_validation.new_reg_partner_amount_million != null) {
    compareValidation(
      new_reg_partner_amount_million,
      input.summary_validation.new_reg_partner_amount_million,
      "summary 시트 신규등록 파트너",
      validation_warnings
    );
  }

  if (win_forecast_partner_amount_million === 0) {
    validation_warnings.push("2026 수주예상 파트너 파이프라인 금액이 0입니다.");
  }
  if (new_reg_partner_amount_million === 0) {
    validation_warnings.push("2026 신규등록 파트너 파이프라인 금액이 0입니다.");
  }

  const save_blockers = [...input.parse_errors];
  if (!input.required_columns_found) {
    save_blockers.push("필수 컬럼을 읽지 못했습니다.");
  }
  if (!input.snapshot_date) {
    save_blockers.push("스냅샷 기준일을 확인할 수 없습니다.");
  }
  if (inventory_rows.filter((row) => row.project_code?.trim()).length === 0) {
    save_blockers.push("프로젝트코드가 있는 행이 없습니다.");
  }

  const revenue_top10 = revenue_rows
    .reduce<
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
      const key = row.partner_name.trim();
      const entry = map.get(key) ?? {
        partner_name: key,
        matched_partner_id: row.matched_partner_id,
        partner_grade: row.partner_grade,
        amount: 0,
        count: 0
      };
      entry.amount += row.product_revenue_million;
      entry.count += row.project_count ?? 1;
      if (!entry.matched_partner_id && row.matched_partner_id) {
        entry.matched_partner_id = row.matched_partner_id;
      }
      map.set(key, entry);
      return map;
    }, new Map())
    .values();

  return {
    summary: {
      snapshot_date: input.snapshot_date,
      snapshot_label: input.snapshot_label,
      inventory_row_count: input.inventory_rows.length,
      win_forecast_partner_amount_million,
      win_forecast_partner_count,
      win_forecast_total_amount_million: Math.round(sumProductAmount(winForecastTotalRows)),
      win_forecast_total_count: uniqueProjectCount(winForecastTotalRows),
      new_reg_partner_amount_million,
      new_reg_partner_count,
      new_reg_total_amount_million: Math.round(sumProductAmount(newRegTotalRows)),
      new_reg_total_count: uniqueProjectCount(newRegTotalRows),
      revenue_partner_amount_million: Math.round(
        revenue_rows.reduce((sum, row) => sum + row.product_revenue_million, 0)
      ),
      revenue_partner_count: revenue_rows.length,
      partner_match_matched,
      partner_match_review,
      validation_warnings,
      can_save: save_blockers.length === 0,
      save_blockers
    },
    inventory_rows,
    revenue_rows,
    win_forecast_top10: buildPartnerTop10(input.inventory_rows, isWinForecastPartnerPipeline),
    new_reg_top10: buildPartnerTop10(input.inventory_rows, isNewRegPartnerPipeline),
    revenue_top10: Array.from(revenue_top10)
      .map((row) => ({
        partner_name: row.partner_name,
        matched_partner_id: row.matched_partner_id,
        partner_grade: row.partner_grade,
        product_revenue_million: Math.round(row.amount),
        project_count: row.count
      }))
      .sort((a, b) => b.product_revenue_million - a.product_revenue_million)
      .slice(0, 10)
  };
}
