import Link from "next/link";
import { ExecutiveRankBarChart } from "@/components/dashboard/bar-chart";
import { LineChart } from "@/components/dashboard/line-chart";
import {
  formatCount,
  formatEokDelta,
  formatEokExecutive,
  formatMillion,
  formatPercent,
  formatSnapshotLabelShort
} from "@/lib/performance/format";
import type { ExecutivePerformanceStats } from "@/types/partner-performance";

const PIPELINE_CARD_CLASS =
  "flex h-full min-h-[10.5rem] flex-col rounded-xl border border-slate-300/90 bg-white p-5 shadow-sm";

export function ExecutivePerformanceSection({ stats }: { stats: ExecutivePerformanceStats }) {
  return (
    <>
      <ExecutivePipelineSummarySection stats={stats} />
      <ExecutivePipelineTrendSection stats={stats} />
      <ExecutiveTopPartnersSection stats={stats} />
    </>
  );
}

export function ExecutivePipelineSummarySection({ stats }: { stats: ExecutivePerformanceStats }) {
  const latest = stats.latest_snapshot;

  if (!latest) {
    return (
      <section className="mt-6 space-y-3">
        <SectionHeader title="2026 파이프라인 요약" href="/dashboard/performance/upload" hrefLabel="업로드" />
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-medium text-slate-700">
          아직 업로드된 파이프라인 스냅샷이 없습니다.{" "}
          <Link href="/dashboard/performance/upload" className="font-bold text-okestro-700 hover:underline">
            실적/파이프라인 업로드
          </Link>
          에서 엑셀을 등록해 주세요.
        </div>
      </section>
    );
  }

  const topWin = stats.win_forecast_top10[0];
  const revenue = stats.revenue_summary;
  const hasRevenueData = revenue.has_data;

  const winShare =
    latest.total_pipeline_amount_million && latest.total_pipeline_amount_million > 0
      ? (latest.partner_pipeline_amount_million ?? 0) / latest.total_pipeline_amount_million
      : null;
  const newShare =
    latest.new_total_pipeline_amount_million && latest.new_total_pipeline_amount_million > 0
      ? (latest.new_partner_pipeline_amount_million ?? 0) / latest.new_total_pipeline_amount_million
      : null;

  return (
    <section className="mt-6 space-y-3">
      <SectionHeader title="2026 파이프라인 요약" href="/dashboard/performance" hrefLabel="파이프라인 상세" />
      <div
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${hasRevenueData ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
      >
        <PipelineCard
          title="2026 수주예상 파트너 파이프라인"
          amount={latest.partner_pipeline_amount_million}
          count={latest.partner_pipeline_count}
          share={winShare}
        />
        <PipelineCard
          title="2026 신규등록 파트너 파이프라인"
          amount={latest.new_partner_pipeline_amount_million}
          count={latest.new_partner_pipeline_count}
          share={newShare}
        />
        <TopPartnerCard
          title="TOP 파이프라인 파트너"
          partnerName={topWin?.partner_name}
          amount={topWin?.amount_million ?? null}
          count={topWin?.project_count ?? null}
        />
        {hasRevenueData ? <RevenueSummaryCard revenue={revenue} /> : null}
      </div>
    </section>
  );
}

export function ExecutivePipelineTrendSection({ stats }: { stats: ExecutivePerformanceStats }) {
  const latest = stats.latest_snapshot;
  if (!latest) return null;

  const trendCount = stats.snapshot_trend.length;
  const showLineCharts = trendCount >= 3;

  return (
    <section className="mt-6 space-y-3">
      <SectionHeader title="파이프라인 추이" href="/dashboard/performance" hrefLabel="파이프라인 상세" />
      {showLineCharts ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChartCard
            title="수주예상 파이프라인 추이"
            data={stats.snapshot_trend.map((point) => ({
              label: formatSnapshotLabelShort(point.snapshot_label, point.snapshot_date),
              value: point.partner_pipeline_amount_million
            }))}
          />
          <TrendChartCard
            title="신규등록 파이프라인 추이"
            data={stats.snapshot_trend.map((point) => ({
              label: formatSnapshotLabelShort(point.snapshot_label, point.snapshot_date),
              value: point.new_partner_pipeline_amount_million
            }))}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendComparisonCard
            title="수주예상 파이프라인"
            trend={stats.snapshot_trend}
            valueKey="partner_pipeline_amount_million"
          />
          <TrendComparisonCard
            title="신규등록 파이프라인"
            trend={stats.snapshot_trend}
            valueKey="new_partner_pipeline_amount_million"
          />
        </div>
      )}
    </section>
  );
}

export function ExecutiveTopPartnersSection({ stats }: { stats: ExecutivePerformanceStats }) {
  const latest = stats.latest_snapshot;
  if (!latest) return null;

  const hasRevenue = stats.revenue_top10.length > 0;

  return (
    <section className="mt-8 space-y-3">
      <SectionHeader title="TOP 파트너" href="/dashboard/performance" hrefLabel="TOP 10 보기" />
      <div className={`grid gap-4 ${hasRevenue ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
        <RankCard title="파트너별 수주예상 TOP 5">
          <ExecutiveRankBarChart
            data={stats.win_forecast_top10.slice(0, 5).map((row) => ({
              label: row.partner_name,
              value: row.amount_million
            }))}
            formatValue={(value) => formatEokExecutive(value) ?? "데이터 없음"}
          />
        </RankCard>
        <RankCard title="파트너별 신규등록 TOP 5">
          <ExecutiveRankBarChart
            data={stats.new_reg_top10.slice(0, 5).map((row) => ({
              label: row.partner_name,
              value: row.amount_million
            }))}
            formatValue={(value) => formatEokExecutive(value) ?? "데이터 없음"}
          />
        </RankCard>
        {hasRevenue ? (
          <RankCard title="파트너별 2025 매출 TOP 5">
            <ExecutiveRankBarChart
              data={stats.revenue_top10.slice(0, 5).map((row) => ({
                label: row.partner_name,
                value: row.product_revenue_million
              }))}
              formatValue={(value) => formatEokExecutive(value) ?? "데이터 없음"}
            />
          </RankCard>
        ) : null}
      </div>
    </section>
  );
}

function SectionHeader({
  title,
  href,
  hrefLabel = "상세 보기"
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-2">
      <h2 className="text-xl font-bold tracking-tight text-slate-950">{title}</h2>
      {href ? (
        <Link href={href} className="text-sm font-bold text-okestro-700 hover:underline">
          {hrefLabel} →
        </Link>
      ) : null}
    </div>
  );
}

function PipelineCard({
  title,
  amount,
  count,
  share
}: {
  title: string;
  amount: number | null;
  count: number | null;
  share: number | null;
}) {
  return (
    <div className={PIPELINE_CARD_CLASS}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{title}</p>
      <p className="mt-2.5 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-950 md:text-4xl">
        {formatEokExecutive(amount)}
      </p>
      <p className="mt-2 text-xs font-medium text-slate-600">
        {formatCount(count)}
        {amount != null ? ` · ${formatMillion(amount)}` : ""}
      </p>
      {share != null ? (
        <p className="mt-auto pt-3 text-xs font-semibold text-slate-700">
          전체 대비 {formatPercent(share)}
        </p>
      ) : (
        <div className="mt-auto" />
      )}
    </div>
  );
}

function RevenueSummaryCard({ revenue }: { revenue: ExecutivePerformanceStats["revenue_summary"] }) {
  return (
    <div className={PIPELINE_CARD_CLASS}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">2025 파트너 매출</p>
      <p className="mt-2.5 text-3xl font-bold tabular-nums tracking-tight text-slate-950 md:text-4xl">
        {formatEokExecutive(revenue.total_million)}
      </p>
      <p className="mt-2 text-xs font-medium text-slate-600">
        {formatCount(revenue.total_project_count)} · {formatMillion(revenue.total_million)}
      </p>
      {revenue.top_partner_name ? (
        <p
          className="mt-auto truncate pt-3 text-xs font-semibold text-slate-700"
          title={revenue.top_partner_name}
        >
          TOP {revenue.top_partner_name}{" "}
          {formatEokExecutive(revenue.top_partner_million, { treatZeroAsEmpty: true })}
        </p>
      ) : (
        <div className="mt-auto" />
      )}
    </div>
  );
}

function TopPartnerCard({
  title,
  partnerName,
  amount,
  count,
  emptyWhenNoData = false,
  subtitleNote
}: {
  title: string;
  partnerName?: string;
  amount: number | null;
  count: number | null;
  emptyWhenNoData?: boolean;
  subtitleNote?: string;
}) {
  const displayAmount = emptyWhenNoData
    ? "데이터 없음"
    : formatEokExecutive(amount, { treatZeroAsEmpty: true });

  return (
    <div className={PIPELINE_CARD_CLASS}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{title}</p>
      <p
        className="mt-2 truncate text-base font-bold text-slate-900"
        title={partnerName && partnerName !== "-" ? partnerName : undefined}
      >
        {emptyWhenNoData ? subtitleNote ?? "-" : partnerName ?? "-"}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-950 md:text-4xl">
        {displayAmount}
      </p>
      {!emptyWhenNoData && count != null ? (
        <p className="mt-auto pt-3 text-xs font-medium text-slate-600">{formatCount(count)}</p>
      ) : (
        <div className="mt-auto" />
      )}
    </div>
  );
}

function TrendChartCard({
  title,
  data
}: {
  title: string;
  data: { label: string; value: number }[];
}) {
  return (
    <div className="flex min-h-[280px] flex-col rounded-xl border border-slate-300/90 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-950">{title}</h3>
      <div className="min-h-0 flex-1">
        <LineChart data={data} height={240} />
      </div>
    </div>
  );
}

function TrendComparisonCard({
  title,
  trend,
  valueKey
}: {
  title: string;
  trend: ExecutivePerformanceStats["snapshot_trend"];
  valueKey: "partner_pipeline_amount_million" | "new_partner_pipeline_amount_million";
}) {
  if (trend.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        {title}: 데이터 없음
      </div>
    );
  }

  if (trend.length === 1) {
    const current = trend[0]!;
    const value = current[valueKey];
    return (
      <div className="rounded-xl border border-slate-300/90 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-950">{title}</p>
        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-slate-950">
          {formatEokExecutive(value)}
        </p>
        <p className="mt-1.5 text-xs font-medium text-slate-600">
          기준 {formatSnapshotLabelShort(current.snapshot_label, current.snapshot_date)}
        </p>
      </div>
    );
  }

  const prev = trend[trend.length - 2]!;
  const curr = trend[trend.length - 1]!;
  const prevValue = prev[valueKey];
  const currValue = curr[valueKey];
  const deltaMillion = currValue - prevValue;
  const deltaPct =
    prevValue > 0 ? Math.round(((currValue - prevValue) / prevValue) * 1000) / 10 : null;

  return (
    <div className="rounded-xl border border-slate-300/90 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-950">{title}</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-2 text-2xl font-bold tabular-nums text-slate-950">
        <span>{formatEokExecutive(prevValue)}</span>
        <span className="text-lg text-slate-500">→</span>
        <span className="text-okestro-700">{formatEokExecutive(currValue)}</span>
      </div>
      <p className="mt-2 text-xs font-medium text-slate-600">
        {formatSnapshotLabelShort(prev.snapshot_label, prev.snapshot_date)} →{" "}
        {formatSnapshotLabelShort(curr.snapshot_label, curr.snapshot_date)}
      </p>
      <p
        className={`mt-3 text-sm font-bold ${deltaMillion >= 0 ? "text-emerald-700" : "text-red-700"}`}
      >
        전월 대비 {formatEokDelta(deltaMillion)}
        {deltaPct != null ? ` (${deltaMillion >= 0 ? "+" : ""}${deltaPct}%)` : ""}
      </p>
    </div>
  );
}

function RankCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-300/90 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-slate-950">{title}</h3>
      {children}
    </div>
  );
}
