import Link from "next/link";
import { LineChart } from "@/components/dashboard/line-chart";
import {
  formatEokExecutive,
  formatMillion,
  formatSnapshotLabelShort
} from "@/lib/performance/format";
import type { ExecutivePerformanceStats } from "@/types/partner-performance";

type TrendPoint = {
  label: string;
  value: number;
};

export function DashboardPipelineTrends({ stats }: { stats: ExecutivePerformanceStats }) {
  if (!stats.latest_snapshot) return null;

  const allPipeline = stats.snapshot_trend.map((point) => ({
    label: formatSnapshotLabelShort(point.snapshot_label, point.snapshot_date),
    value: point.partner_pipeline_amount_million
  }));
  const newPipeline = stats.snapshot_trend.map((point) => ({
    label: formatSnapshotLabelShort(point.snapshot_label, point.snapshot_date),
    value: point.new_partner_pipeline_amount_million
  }));

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-slate-950">파트너 파이프라인 추이</h2>
        <Link href="/dashboard/performance" className="text-xs font-bold text-okestro-700 hover:underline">
          상세 →
        </Link>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <DashboardTrendCard title="전체 영업기회 추이" data={allPipeline} />
        <DashboardTrendCard title="신규등록 파이프라인 추이" data={newPipeline} />
      </div>
    </section>
  );
}

function DashboardTrendCard({ title, data }: { title: string; data: TrendPoint[] }) {
  return (
    <div className="flex min-h-[16rem] flex-col rounded-xl border border-slate-200 bg-slate-50/45 p-3">
      <h3 className="mb-1 px-1 text-xs font-semibold text-slate-900">{title}</h3>
      <div className="min-h-0 flex-1">
        <LineChart
          compact
          data={data}
          height={225}
          formatValue={(value) => formatEokExecutive(value)}
          formatTooltip={(value) => `${formatEokExecutive(value)} (${formatMillion(value)})`}
        />
      </div>
    </div>
  );
}
