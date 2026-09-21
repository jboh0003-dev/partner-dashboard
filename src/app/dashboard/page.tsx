import { Suspense } from "react";
import { AnimatedSection } from "@/components/common/animated-section";
import { Skeleton } from "@/components/common/skeleton";
import { BrandLoading } from "@/components/common/brand-loading";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { ExecutiveKpiGrid } from "@/components/dashboard/executive-kpi-grid";
import { PartnerCompositionSection } from "@/components/dashboard/partner-composition-section";
import { PageHero } from "@/components/layout/page-hero";
import { DashboardPipelineTrends } from "@/components/performance/dashboard-pipeline-trends";
import { ExecutivePipelineSummarySection } from "@/components/performance/executive-performance-section";
import { fetchDashboardRuntimeStats } from "@/lib/data/dashboard-runtime";
import { fetchExecutivePerformanceStats } from "@/lib/data/partner-performance";

/** 통계는 짧게 캐시해 초기 접속·페이지 전환을 가볍게 유지 */
export const revalidate = 120;

function SectionSkeleton({ height = "h-40" }: { height?: string }) {
  return (
    <Skeleton className={`mt-4 w-full rounded-xl border border-slate-200 ${height}`} />
  );
}

function DashboardHero() {
  return (
    <AnimatedSection>
      <PageHero
        compact
        eyebrow={null}
        prominentTitle
        title={
          <span className="inline-flex flex-wrap items-baseline gap-x-2 overflow-visible leading-[1.08]">
            <span>OKESTRO Partner</span>
            <span className="inline-block overflow-visible bg-gradient-to-r from-sky-300 via-blue-300 to-cyan-200 bg-clip-text pr-2 font-black italic tracking-[-0.025em] text-transparent">
              Connect
            </span>
          </span>
        }
      />
    </AnimatedSection>
  );
}

type StatsPromise = ReturnType<typeof fetchDashboardRuntimeStats>;
type PerformancePromise = ReturnType<typeof fetchExecutivePerformanceStats>;

async function Kpis({ data }: { data: StatsPromise }) {
  const stats = await data;
  return <ExecutiveKpiGrid compact stats={stats} currentYear={new Date().getFullYear()} />;
}

async function Composition({ data }: { data: StatsPromise }) {
  return <PartnerCompositionSection compact stats={await data} />;
}

async function PipelineSummary({ data }: { data: PerformancePromise }) {
  return <ExecutivePipelineSummarySection compact stats={await data} />;
}

async function PipelineTrends({ data }: { data: PerformancePromise }) {
  return <DashboardPipelineTrends stats={await data} />;
}

export default function DashboardPage() {
  // Start both reads once, then stream independent sections as each finishes.
  // Share the same promises between consumers; retain existing cache/permissions.
  const stats = fetchDashboardRuntimeStats();
  const performance = fetchExecutivePerformanceStats();
  return (
    <>
      <DashboardHero />
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[0.92fr_1.48fr]">
        <div className="min-w-0 space-y-4">
          <Suspense fallback={<BrandLoading message="파트너 현황을 불러오고 있습니다." />}>
            <Kpis data={stats} />
          </Suspense>
          <Suspense fallback={<BrandLoading message="파이프라인을 불러오고 있습니다." />}>
            <PipelineSummary data={performance} />
          </Suspense>
          <DashboardQuickActions />
        </div>
        <div className="min-w-0 space-y-4">
          <Suspense fallback={<SectionSkeleton height="h-64" />}>
            <Composition data={stats} />
          </Suspense>
          <Suspense fallback={<SectionSkeleton height="h-64" />}>
            <PipelineTrends data={performance} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
