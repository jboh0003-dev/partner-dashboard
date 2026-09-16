import Link from "next/link";
import { GradeDistributionChart } from "@/components/dashboard/bar-chart";
import type { DashboardStats } from "@/lib/data/dashboard";

type PartnerCompositionSectionProps = {
  stats: Pick<DashboardStats, "gradeDist" | "regionDist" | "partnerCount">;
  compact?: boolean;
};

export function PartnerCompositionSection({
  stats,
  compact = false
}: PartnerCompositionSectionProps) {
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

  if (compact) {
    return (
      <section className="h-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight text-slate-950">파트너 구성</h2>
          <Link href="/dashboard/partners" className="text-xs font-bold text-okestro-700 hover:underline">
            파트너 상세 →
          </Link>
        </div>

        <div className="mt-3 grid gap-3 2xl:grid-cols-2">
          <CompositionCard title="등급별 구성" compact>
            {stats.gradeDist.length === 0 ? (
              <EmptyChart message="등급 데이터가 없습니다." compact />
            ) : (
              <GradeDistributionChart
                compact
                data={stats.gradeDist.map((item) => ({
                  label: item.label,
                  value: item.value,
                  color: item.color,
                  muted: item.label === "미분류" && item.value <= 1
                }))}
              />
            )}
          </CompositionCard>

          <CompositionCard title="권역별 구성" subtitle={regionInsight ?? undefined} compact>
            {regionData.every((item) => item.value === 0) ? (
              <EmptyChart message="권역 데이터가 없습니다." compact />
            ) : (
              <GradeDistributionChart
                compact
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

function CompositionCard({
  title,
  subtitle,
  children,
  compact = false
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col border bg-white",
        compact
          ? "min-h-[235px] rounded-xl border-slate-200/80 bg-slate-50/45 p-3.5"
          : "min-h-[320px] rounded-xl border-slate-300/90 p-5 shadow-sm"
      ].join(" ")}
    >
      <div className={compact ? "mb-2" : "mb-4"}>
        <h3 className={compact ? "text-xs font-bold text-slate-950" : "text-sm font-bold text-slate-950"}>
          {title}
        </h3>
        {subtitle ? (
          <p className={compact ? "mt-0.5 text-[10px] font-medium text-slate-500" : "mt-1 text-xs font-medium text-slate-600"}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

function EmptyChart({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div
      className={[
        "flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-600",
        compact ? "h-[170px]" : "h-[220px]"
      ].join(" ")}
    >
      {message}
    </div>
  );
}
