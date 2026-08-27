import Link from "next/link";
import { LineChart } from "@/components/dashboard/line-chart";
import {
  formatEokDelta,
  formatEokExecutive,
  formatMillion,
  formatPercent,
  formatSnapshotLabelShort
} from "@/lib/performance/format";
import type { ExecutivePerformanceStats } from "@/types/partner-performance";

const PIPELINE_CARD_CLASS =
  "flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-card";

export function ExecutivePerformanceSection({ stats }: { stats: ExecutivePerformanceStats }) {
  return (
    <>
      <ExecutivePipelineSummarySection stats={stats} />
      <ExecutivePipelineTrendSection stats={stats} />
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

  const expectedShare =
    stats.all_opportunity_amount_million > 0
      ? stats.expected_win_amount_million / stats.all_opportunity_amount_million
      : null;
  const yearLabel = latest.snapshot_date?.slice(0, 4) || "2026";

  return (
    <section className="mt-6 space-y-3">
      <SectionHeader
        title="파트너 파이프라인"
        href="/dashboard/performance"
        hrefLabel="파이프라인 상세"
      />
      <p className="text-sm text-slate-500">
        기준일 {latest.snapshot_date} ({latest.snapshot_label}) · FY26 · 파트너딜 · 제품매출
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PipelineCard
          title="수주 예상 파이프라인"
          amount={stats.expected_win_amount_million}
          supporting={`${yearLabel}년 · ${stats.expected_win_count.toLocaleString("ko-KR")}건 · 50%(F) 이상`}
          share={expectedShare}
          featured
        />
        <PipelineCard
          title="전체 영업기회"
          amount={stats.all_opportunity_amount_million}
          supporting={`${yearLabel}년 · ${stats.all_opportunity_count.toLocaleString("ko-KR")}건`}
          share={null}
        />
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
  supporting,
  share,
  featured
}: {
  title: string;
  amount: number | null;
  supporting?: string;
  share: number | null;
  featured?: boolean;
}) {
  return (
    <div
      className={
        featured
          ? `${PIPELINE_CARD_CLASS} border-l-[3px] border-okestro-600 bg-gradient-to-br from-white via-okestro-50/40 to-slate-50 shadow-md ring-1 ring-okestro-100`
          : PIPELINE_CARD_CLASS
      }
    >
      <p className="text-base font-semibold leading-snug text-slate-900">{title}</p>
      <p
        className={
          featured
            ? "mt-1.5 text-[2.25rem] font-bold tabular-nums leading-none tracking-tight text-slate-950"
            : "mt-1.5 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-slate-800"
        }
      >
        {formatEokExecutive(amount)}
      </p>
      {supporting ? (
        <p className="mt-2 text-sm font-medium leading-snug text-slate-600">{supporting}</p>
      ) : null}
      {share != null ? (
        <p className="mt-1 text-sm font-medium leading-snug text-slate-600">
          전체 영업기회의 {formatPercent(share)}
        </p>
      ) : null}
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
    <div className="flex min-h-[26rem] flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="mb-1 px-1 text-[15px] font-semibold text-slate-900">{title}</h3>
      <div className="min-h-0 flex-1">
        <LineChart
          data={data}
          height={360}
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
