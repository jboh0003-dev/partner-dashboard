import { formatCount, formatMillion } from "@/lib/performance/format";
import { isExpectedWinPartnerPipeline } from "@/lib/performance/expected-win";
import { isFy26 } from "@/lib/performance/format";
import type { PartnerPipelineOpportunity } from "@/types/partner-performance";

type PartnerPerformanceBundle = {
  snapshot: { snapshot_date: string; snapshot_label: string } | null;
  win_forecast_amount_million: number;
  win_forecast_count: number;
  all_opportunity_amount_million: number;
  all_opportunity_count: number;
  new_reg_amount_million: number;
  new_reg_count: number;
  revenue_amount_million: number;
  revenue_count: number;
  opportunities: PartnerPipelineOpportunity[];
  win_probability_breakdown: Array<{ label: string; amount_million: number; count: number }>;
};

function formatExpectedTiming(row: PartnerPipelineOpportunity): string {
  const parts = [row.expected_win_year, row.expected_win_quarter, row.expected_win_month]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "-";
}

function isAllOpportunity(row: PartnerPipelineOpportunity): boolean {
  return row.is_partner_deal && row.is_product_revenue && isFy26(row.expected_win_year);
}

export function PartnerPerformanceTab({ performance }: { performance: PartnerPerformanceBundle }) {
  if (!performance.snapshot) {
    return (
      <p className="text-sm text-slate-600">
        등록된 파이프라인 스냅샷이 없습니다. 실적/파이프라인 업로드 후 표시됩니다.
      </p>
    );
  }

  const expectedRows = performance.opportunities.filter(isExpectedWinPartnerPipeline);
  const allRows = performance.opportunities.filter(isAllOpportunity);

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        기준일: {performance.snapshot.snapshot_date} ({performance.snapshot.snapshot_label})
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="수주 예상 프로젝트"
          hint="50%(F), 75%, 90%, 100%"
          amount={performance.win_forecast_amount_million}
          count={performance.win_forecast_count}
        />
        <SummaryCard
          label="전체 영업기회"
          hint="FY26 · 파트너딜 · 제품매출"
          amount={performance.all_opportunity_amount_million}
          count={performance.all_opportunity_count}
        />
        <SummaryCard
          label="2025 매출"
          hint="연간 실적"
          amount={performance.revenue_amount_million}
          count={performance.revenue_count}
        />
      </div>

      {performance.win_probability_breakdown.length > 0 ? (
        <div>
          <h3 className="text-sm font-bold text-slate-900">수주확도별 전체 영업기회</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {performance.win_probability_breakdown.map((row) => (
              <span
                key={row.label}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {row.label}: {formatMillion(row.amount_million)} ({formatCount(row.count)})
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <OpportunityList
        title="수주 예상 프로젝트"
        description="50%(F) · 75% · 90% · 100% (50%(U), 25%, 0% 제외)"
        count={performance.win_forecast_count}
        amount={performance.win_forecast_amount_million}
        rows={expectedRows}
      />
      <OpportunityList
        title="전체 영업기회"
        description="FY26 · 파트너딜 O · 제품매출 O (모든 수주확도)"
        count={performance.all_opportunity_count}
        amount={performance.all_opportunity_amount_million}
        rows={allRows}
      />
    </div>
  );
}

function SummaryCard({
  label,
  hint,
  amount,
  count
}: {
  label: string;
  hint: string;
  amount: number;
  count: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{formatMillion(amount)}</p>
      <p className="mt-1 text-sm text-slate-600">{formatCount(count)}</p>
      <p className="mt-1 text-2xs text-slate-400">{hint}</p>
    </div>
  );
}

function OpportunityList({
  title,
  description,
  count,
  amount,
  rows
}: {
  title: string;
  description: string;
  count: number;
  amount: number;
  rows: PartnerPipelineOpportunity[];
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <p className="text-xs font-semibold text-slate-700">
          {formatCount(count)} · {formatMillion(amount)}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          해당하는 프로젝트가 없습니다.
        </p>
      ) : (
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">고객사</th>
                <th className="px-3 py-2 text-left">프로젝트명</th>
                <th className="px-3 py-2 text-left">프로젝트코드</th>
                <th className="px-3 py-2 text-left">수주확도</th>
                <th className="px-3 py-2 text-left">예상수주 시점</th>
                <th className="px-3 py-2 text-right">제품매출</th>
                <th className="px-3 py-2 text-left">영업담당자</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.customer_name ?? "-"}</td>
                  <td className="px-3 py-2">{row.project_name ?? "-"}</td>
                  <td className="px-3 py-2">{row.project_code}</td>
                  <td className="px-3 py-2">{row.win_probability_label ?? "-"}</td>
                  <td className="px-3 py-2">{formatExpectedTiming(row)}</td>
                  <td className="px-3 py-2 text-right">{formatMillion(row.product_amount_million)}</td>
                  <td className="px-3 py-2">{row.sales_owner ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
