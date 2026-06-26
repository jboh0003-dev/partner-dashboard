import Link from "next/link";
import { HorizontalBarChart, VerticalBarChart } from "@/components/dashboard/bar-chart";
import { LineChart } from "@/components/dashboard/line-chart";
import { formatCount, formatEok, formatEokPrimary, formatMillion, formatPercent } from "@/lib/performance/format";
import type { ExecutivePerformanceStats } from "@/types/partner-performance";

export function ExecutivePerformanceSection({ stats }: { stats: ExecutivePerformanceStats }) {
  const latest = stats.latest_snapshot;
  if (!latest) {
    return (
      <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <h2 className="text-lg font-bold text-slate-900">파트너 실적/파이프라인</h2>
        <p className="mt-2 text-sm text-slate-600">
          아직 업로드된 파이프라인 스냅샷이 없습니다.{" "}
          <Link href="/dashboard/performance/upload" className="font-semibold text-okestro-600 hover:underline">
            실적/파이프라인 업로드
          </Link>
          에서 엑셀을 등록해 주세요.
        </p>
      </section>
    );
  }

  const prev = stats.previous_snapshot;
  const winShare =
    latest.total_pipeline_amount_million && latest.total_pipeline_amount_million > 0
      ? (latest.partner_pipeline_amount_million ?? 0) / latest.total_pipeline_amount_million
      : null;
  const newShare =
    latest.new_total_pipeline_amount_million && latest.new_total_pipeline_amount_million > 0
      ? (latest.new_partner_pipeline_amount_million ?? 0) / latest.new_total_pipeline_amount_million
      : null;

  const winDelta =
    prev && prev.partner_pipeline_amount_million
      ? (latest.partner_pipeline_amount_million ?? 0) - prev.partner_pipeline_amount_million
      : null;
  const newDelta =
    prev && prev.new_partner_pipeline_amount_million
      ? (latest.new_partner_pipeline_amount_million ?? 0) - prev.new_partner_pipeline_amount_million
      : null;

  const topWin = stats.win_forecast_top10[0];
  const topRevenue = stats.revenue_top10[0];

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">파트너 실적/파이프라인</h2>
          <p className="mt-1 text-xs text-slate-500">
            기준일: {latest.snapshot_date} ({latest.snapshot_label}) · 금액 단위: 백만원 원본 / 억원 환산
          </p>
        </div>
        <Link href="/dashboard/performance" className="text-sm font-semibold text-okestro-600 hover:underline">
          상세 보기 →
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ExecKpi
          title="2026 수주예상 파트너 파이프라인"
          amount={latest.partner_pipeline_amount_million}
          count={latest.partner_pipeline_count}
          share={winShare}
          deltaMillion={winDelta}
        />
        <ExecKpi
          title="2026 신규등록 파트너 파이프라인"
          amount={latest.new_partner_pipeline_amount_million}
          count={latest.new_partner_pipeline_count}
          share={newShare}
          deltaMillion={newDelta}
        />
        <ExecKpi
          title="2025 파트너 매출"
          amount={stats.revenue_top10.reduce((sum, row) => sum + row.product_revenue_million, 0)}
          count={stats.revenue_top10.reduce((sum, row) => sum + row.project_count, 0)}
        />
        <ExecKpi
          title="Top 파이프라인 파트너"
          subtitle={topWin?.partner_name ?? "-"}
          amount={topWin?.amount_million ?? null}
          count={topWin?.project_count ?? null}
        />
        <ExecKpi
          title="Top 매출 파트너"
          subtitle={topRevenue?.partner_name ?? "-"}
          amount={topRevenue?.product_revenue_million ?? null}
          count={topRevenue?.project_count ?? null}
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase text-amber-800">검토 필요</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{stats.unmatched_partner_count}</p>
          <p className="mt-1 text-xs text-amber-800">파트너명 매칭 실패 {stats.review_count}건</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="수주예상 파이프라인 추이">
          <LineChart
            data={stats.snapshot_trend.map((point) => ({
              label: point.snapshot_label,
              value: point.partner_pipeline_amount_million
            }))}
          />
        </ChartCard>
        <ChartCard title="신규등록 파이프라인 추이">
          <LineChart
            data={stats.snapshot_trend.map((point) => ({
              label: point.snapshot_label,
              value: point.new_partner_pipeline_amount_million
            }))}
          />
        </ChartCard>
        <ChartCard title="수주확도별 파이프라인">
          <VerticalBarChart
            data={stats.win_probability_breakdown.slice(0, 8).map((row) => ({
              label: row.label,
              value: row.amount_million
            }))}
            barColor="fill-violet-500"
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="파트너별 수주예상 Top 10">
          <HorizontalBarChart
            data={stats.win_forecast_top10.map((row) => ({
              label: row.partner_name,
              value: row.amount_million
            }))}
          />
        </ChartCard>
        <ChartCard title="파트너별 신규등록 Top 10">
          <HorizontalBarChart
            data={stats.new_reg_top10.map((row) => ({
              label: row.partner_name,
              value: row.amount_million
            }))}
          />
        </ChartCard>
      </div>
    </section>
  );
}

function ExecKpi({
  title,
  subtitle,
  amount,
  count,
  share,
  deltaMillion
}: {
  title: string;
  subtitle?: string;
  amount: number | null;
  count?: number | null;
  share?: number | null;
  deltaMillion?: number | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {subtitle ? <p className="mt-1 text-sm font-medium text-slate-700">{subtitle}</p> : null}
      <p className="mt-2 text-3xl font-bold text-slate-900">{formatEokPrimary(amount)}</p>
      <p className="mt-1 text-sm text-slate-600">
        {count != null ? formatCount(count) : "-"} · {formatMillion(amount)}
      </p>
      {share != null ? <p className="mt-1 text-xs text-slate-500">전체 대비 {formatPercent(share)}</p> : null}
      {deltaMillion != null ? (
        <p className={`mt-1 text-xs font-semibold ${deltaMillion >= 0 ? "text-emerald-700" : "text-red-600"}`}>
          이전 스냅샷 대비 {deltaMillion >= 0 ? "+" : ""}
          {formatMillion(deltaMillion)}
        </p>
      ) : null}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[280px] flex-col rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <div className="mt-3 min-h-0 flex-1">{children}</div>
    </div>
  );
}
