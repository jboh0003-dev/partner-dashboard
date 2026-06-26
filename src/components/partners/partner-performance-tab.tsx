import { formatCount, formatEok, formatMillion } from "@/lib/performance/format";
import type { PartnerPipelineOpportunity } from "@/types/partner-performance";

type PartnerPerformanceBundle = {
  snapshot: { snapshot_date: string; snapshot_label: string } | null;
  win_forecast_amount_million: number;
  win_forecast_count: number;
  new_reg_amount_million: number;
  new_reg_count: number;
  revenue_amount_million: number;
  revenue_count: number;
  opportunities: PartnerPipelineOpportunity[];
  win_probability_breakdown: Array<{ label: string; amount_million: number; count: number }>;
};

export function PartnerPerformanceTab({ performance }: { performance: PartnerPerformanceBundle }) {
  if (!performance.snapshot) {
    return (
      <p className="text-sm text-slate-600">
        등록된 파이프라인 스냅샷이 없습니다. 실적/파이프라인 업로드 후 표시됩니다.
      </p>
    );
  }

  const winOpportunities = performance.opportunities.filter(
    (row) =>
      row.is_partner_deal &&
      row.is_product_revenue &&
      String(row.expected_win_year ?? "").toUpperCase() === "FY26"
  );
  const newOpportunities = performance.opportunities.filter(
    (row) =>
      row.is_partner_deal &&
      row.is_product_revenue &&
      String(row.project_registered_year ?? "").startsWith("2026")
  );

  return (
    <div className="space-y-6">
      <p className="text-xs text-slate-500">
        기준일: {performance.snapshot.snapshot_date} ({performance.snapshot.snapshot_label})
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["2026 수주예상 파이프라인", performance.win_forecast_amount_million, performance.win_forecast_count],
          ["2026 신규등록 파이프라인", performance.new_reg_amount_million, performance.new_reg_count],
          ["2025 매출", performance.revenue_amount_million, performance.revenue_count]
        ].map(([label, amount, count]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatEok(Number(amount))}</p>
            <p className="mt-1 text-sm text-slate-600">
              {formatCount(Number(count))} · {formatMillion(Number(amount))}
            </p>
          </div>
        ))}
      </div>

      {performance.win_probability_breakdown.length > 0 ? (
        <div>
          <h3 className="text-sm font-bold text-slate-900">수주확도별 기회</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {performance.win_probability_breakdown.map((row) => (
              <span key={row.label} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {row.label}: {formatEok(row.amount_million)} ({formatCount(row.count)})
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <OpportunityList title="수주예상 주요 프로젝트" rows={winOpportunities.slice(0, 15)} />
      <OpportunityList title="신규등록 영업기회" rows={newOpportunities.slice(0, 15)} />
    </div>
  );
}

function OpportunityList({
  title,
  rows
}: {
  title: string;
  rows: PartnerPipelineOpportunity[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">고객사</th>
              <th className="px-3 py-2 text-left">프로젝트</th>
              <th className="px-3 py-2 text-left">코드</th>
              <th className="px-3 py-2 text-left">확도</th>
              <th className="px-3 py-2 text-right">제품합계</th>
              <th className="px-3 py-2 text-left">영업담당</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2">{row.customer_name ?? "-"}</td>
                <td className="px-3 py-2">{row.project_name ?? "-"}</td>
                <td className="px-3 py-2">{row.project_code}</td>
                <td className="px-3 py-2">{row.win_probability_label ?? "-"}</td>
                <td className="px-3 py-2 text-right">{formatMillion(row.product_amount_million)}</td>
                <td className="px-3 py-2">{row.sales_owner ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
