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
  "flex h-full min-h-[10.5rem] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card";

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
        <SectionHeader title="파트너 파이프라인" href="/dashboard/performance/upload" hrefLabel="업로드" />
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

  const topPartner = stats.all_opportunity_top10[0] ?? stats.expected_win_top10[0];
  const revenue = stats.revenue_summary;
  const hasRevenueData = revenue.has_data;
  const expectedShare =
    stats.all_opportunity_amount_million > 0
      ? stats.expected_win_amount_million / stats.all_opportunity_amount_million
      : null;

  return (
    <section className="mt-6 space-y-3">
      <SectionHeader
        title="파트너 파이프라인"
        href="/dashboard/performance"
        hrefLabel="파이프라인 상세"
      />
      <p className="text-xs text-slate-500">
        기준일 {latest.snapshot_date} ({latest.snapshot_label}) · FY26 · 파트너딜 · 제품매출
      </p>
      <div
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${hasRevenueData ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
      >
        <PipelineCard
          title="수주예상 파이프라인"
          amount={stats.expected_win_amount_million}
          count={stats.expected_win_count}
          share={expectedShare}
          shareLabel="전체 영업기회 대비"
          hint="2026년 · 50%(F) 이상"
          featured
        />
        <TopPartnerCard
          title="TOP 파이프라인 파트너"
          partnerName={stats.expected_win_top10[0]?.partner_name ?? topPartner?.partner_name}
          amount={stats.expected_win_top10[0]?.amount_million ?? topPartner?.amount_million ?? null}
          count={stats.expected_win_top10[0]?.project_count ?? topPartner?.project_count ?? null}
        />
        <PipelineCard
          title="전체 영업기회"
          amount={stats.all_opportunity_amount_million}
          count={stats.all_opportunity_count}
          share={null}
          hint="파트너딜 · 제품매출"
        />
        {hasRevenueData ? <RevenueSummaryCard revenue={revenue} /> : null}
      </div>
      {stats.win_probability_breakdown.length > 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
          <h3 className="text-sm font-bold text-slate-900">수주확도 · 50%(F) 이상 우선</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.win_probability_breakdown
              .filter((row) => ["50%(F)", "75%", "90%", "100%"].includes(row.label))
              .map((row) => (
                <span
                  key={row.label}
                  className="rounded-full bg-okestro-50 px-3 py-1 text-xs font-semibold text-okestro-800 ring-1 ring-okestro-100"
                >
                  {row.label}: {formatMillion(row.amount_million)} ({formatCount(row.count)})
                </span>
              ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            보조{" "}
            {stats.win_probability_breakdown
              .filter((row) => ["0%", "25%", "50%(U)"].includes(row.label) && row.count > 0)
              .map((row) => `${row.label} ${formatCount(row.count)}`)
              .join(" · ") || "없음"}
          </p>
        </div>
      ) : null}
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
      <SectionHeader title="파트너 파이프라인 추이" href="/dashboard/performance" hrefLabel="파이프라인 상세" />
      {showLineCharts ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendChartCard
            title="수주예상 파이프라인"
            data={stats.snapshot_trend.map((point) => ({
              label: formatSnapshotLabelShort(point.snapshot_label, point.snapshot_date),
              value: point.partner_pipeline_amount_million
            }))}
          />
          <TrendChartCard
            title="신규등록 파이프라인"
            data={stats.snapshot_trend.map((point) => ({
              label: formatSnapshotLabelShort(point.snapshot_label, point.snapshot_date),
              value: point.new_partner_pipeline_amount_million
            }))}
          />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendComparisonCard
            title="파트너 파이프라인"
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
        <RankCard title="파트너별 수주 예상 TOP 5">
          <ExecutiveRankBarChart
            data={stats.expected_win_top10.slice(0, 5).map((row) => ({
              label: row.partner_name,
              value: row.amount_million
            }))}
            formatValue={(value) => formatEokExecutive(value) ?? "데이터 없음"}
          />
        </RankCard>
        <RankCard title="파트너별 전체 영업기회 TOP 5">
          <ExecutiveRankBarChart
            data={stats.all_opportunity_top10.slice(0, 5).map((row) => ({
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
  share,
  shareLabel = "전체 대비",
  hint,
  featured
}: {
  title: string;
  amount: number | null;
  count: number | null;
  share: number | null;
  shareLabel?: string;
  hint?: string;
  featured?: boolean;
}) {
  return (
    <div
      className={
        featured
          ? `${PIPELINE_CARD_CLASS} min-h-[12.5rem] border-okestro-300 bg-gradient-to-br from-white via-okestro-50/40 to-slate-50 ring-1 ring-okestro-100`
          : PIPELINE_CARD_CLASS
      }
    >
      <p className={featured ? "text-sm font-semibold leading-snug text-okestro-800" : "text-sm font-semibold leading-snug text-slate-800"}>
        {title}
      </p>
      <p className="mt-3 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-950">
        {formatEokExecutive(amount)}
      </p>
      <p className="mt-2 text-xs font-medium text-slate-500">
        {hint ? `${hint} · ` : ""}
        {formatCount(count)}
        {amount != null ? ` · ${formatMillion(amount)}` : ""}
      </p>
      {share != null ? (
        <p className="mt-auto pt-3 text-xs font-medium text-slate-600">
          {shareLabel} {formatPercent(share)}
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
      <p className="text-sm font-semibold leading-snug text-slate-800">2025 파트너 매출</p>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-slate-950">
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
      <p className="text-sm font-semibold leading-snug text-slate-800">{title}</p>
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
    <div className="flex min-h-[22rem] flex-col rounded-xl border border-slate-300/90 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">{title}</h3>
      <div className="min-h-0 flex-1">
          <LineChart
            data={data}
            height={320}
            formatValue={(value) => formatEokExecutive(value)}
            formatTooltip={(value) => `${formatEokExecutive(value)} (${formatMillion(value)})`}
          />
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
    <div className="flex min-h-[20rem] flex-col rounded-xl border border-slate-300/90 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-bold text-slate-950">{title}</h3>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
