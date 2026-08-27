import { EmptyState } from "@/components/common/empty-state";
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
  revenue_has_data?: boolean;
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
      <EmptyState
        compact
        title="실적 데이터가 없습니다"
        description="실적/파이프라인 엑셀을 업로드하면 이 파트너의 수주 예상과 영업기회가 표시됩니다."
      />
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
          hint="50%(F) · 75% · 90% · 100%"
          amount={performance.win_forecast_amount_million}
          count={performance.win_forecast_count}
          featured
        />
        <SummaryCard
          label="파트너 전체 영업기회"
          hint="FY26 · 파트너딜 · 제품매출 · 보조"
          amount={performance.all_opportunity_amount_million}
          count={performance.all_opportunity_count}
        />
        <RevenueCard
          hasData={Boolean(performance.revenue_has_data)}
          amount={performance.revenue_amount_million}
          count={performance.revenue_count}
        />
      </div>

      {performance.win_probability_breakdown.length > 0 ? (
        <WinProbabilityBreakdown rows={performance.win_probability_breakdown} />
      ) : null}

      <OpportunityList
        title="수주 예상 프로젝트"
        description="50%(F) · 75% · 90% · 100% 위주. 현재 자료는 영업 파이프라인 스냅샷이며 실제 수주 확정 여부는 별도 확인이 필요합니다."
        count={performance.win_forecast_count}
        amount={performance.win_forecast_amount_million}
        rows={expectedRows}
      />
      <OpportunityList
        title="파트너 전체 영업기회"
        description="보조 영역 · FY26 · 파트너딜 · 제품매출 (0% · 25% · 50%(U) 포함)"
        count={performance.all_opportunity_count}
        amount={performance.all_opportunity_amount_million}
        rows={allRows}
        muted
      />
    </div>
  );
}

function SummaryCard({
  label,
  hint,
  amount,
  count,
  featured
}: {
  label: string;
  hint: string;
  amount: number;
  count: number;
  featured?: boolean;
}) {
  return (
    <div
      className={
        featured
          ? "rounded-2xl border border-okestro-200 bg-gradient-to-br from-white to-okestro-50 p-4 shadow-card"
          : "rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{formatMillion(amount)}</p>
      <p className="mt-1 text-sm text-slate-600">{formatCount(count)}</p>
      <p className="mt-1 text-2xs text-slate-400">{hint}</p>
    </div>
  );
}

function RevenueCard({
  hasData,
  amount,
  count
}: {
  hasData: boolean;
  amount: number;
  count: number;
}) {
  if (!hasData) {
    return (
      <EmptyState
        compact
        title="실적 데이터가 없습니다"
        description="연간 매출 원장이 이 파트너에 매칭되지 않았습니다. 0으로 표시하지 않습니다."
      />
    );
  }

  return (
    <SummaryCard label="2025 매출" hint="연간 실적 원장 기준" amount={amount} count={count} />
  );
}

function WinProbabilityBreakdown({
  rows
}: {
  rows: Array<{ label: string; amount_million: number; count: number }>;
}) {
  const primary = rows.filter((row) => ["50%(F)", "75%", "90%", "100%"].includes(row.label));
  const secondary = rows.filter((row) => ["0%", "25%", "50%(U)"].includes(row.label));
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">수주확도</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {primary.map((row) => (
          <span
            key={row.label}
            className="rounded-full bg-okestro-50 px-3 py-1 text-xs font-semibold text-okestro-800 ring-1 ring-okestro-100"
          >
            {row.label}: {formatMillion(row.amount_million)} ({formatCount(row.count)})
          </span>
        ))}
      </div>
      {secondary.some((row) => row.count > 0) ? (
        <p className="mt-2 text-xs text-slate-500">
          보조 {secondary.filter((row) => row.count > 0).map((row) => `${row.label} ${formatCount(row.count)}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function OpportunityList({
  title,
  description,
  count,
  amount,
  rows,
  muted
}: {
  title: string;
  description: string;
  count: number;
  amount: number;
  rows: PartnerPipelineOpportunity[];
  muted?: boolean;
}) {
  return (
    <div className={muted ? "rounded-2xl border border-slate-100 bg-slate-50/50 p-4" : undefined}>
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
