import Link from "next/link";
import { GradeDistributionChart } from "@/components/dashboard/bar-chart";
import type { DashboardStats } from "@/lib/data/dashboard";

type PartnerCompositionSectionProps = {
  stats: Pick<DashboardStats, "gradeDist" | "regionDist" | "partnerCount">;
};

export function PartnerCompositionSection({ stats }: PartnerCompositionSectionProps) {
  const regionData =
    stats.regionDist.length > 0
      ? stats.regionDist
      : [{ label: "미지정", value: stats.partnerCount, color: "bg-slate-400" }];

  const topRegion = regionData[0];
  const topRegionShare =
    topRegion && stats.partnerCount > 0
      ? (topRegion.value / stats.partnerCount) * 100
      : null;
  const regionInsight =
    topRegion && topRegionShare != null && topRegionShare >= 50
      ? topRegion.label.includes("수도권")
        ? "수도권 중심 파트너 분포"
        : `${topRegion.label} 중심 파트너 분포`
      : null;

  return (
    <section className="mt-8 space-y-3">
      <SectionHeading title="파트너 구성" href="/dashboard/partners" hrefLabel="파트너 상세" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CompositionCard title="등급별 파트너 구성">
          {stats.gradeDist.length === 0 ? (
            <EmptyChart message="등급 데이터가 없습니다." />
          ) : (
            <GradeDistributionChart
              data={stats.gradeDist.map((item) => ({
                label: item.label,
                value: item.value,
                color: item.color,
                muted: item.label === "미분류" && item.value <= 1
              }))}
            />
          )}
        </CompositionCard>

        <CompositionCard
          title="권역별 파트너 구성"
          subtitle={regionInsight ?? undefined}
        >
          {regionData.every((item) => item.value === 0) ? (
            <EmptyChart message="권역 데이터가 없습니다." />
          ) : (
            <GradeDistributionChart
              data={regionData.map((item) => ({
                ...item,
                muted: item.label === "미분류" && item.value <= 1
              }))}
            />
          )}
        </CompositionCard>
      </div>
    </section>
  );
}

function SectionHeading({
  title,
  href,
  hrefLabel
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {href ? (
        <Link href={href} className="text-sm font-semibold text-okestro-600 hover:underline">
          {hrefLabel} →
        </Link>
      ) : null}
    </div>
  );
}

function CompositionCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[280px] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-xs text-slate-400">
      {message}
    </div>
  );
}
