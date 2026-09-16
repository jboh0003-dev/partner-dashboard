import { Suspense } from "react";
import { AnimatedSection } from "@/components/common/animated-section";
import { Skeleton } from "@/components/common/skeleton";
import { DashboardQuickActions } from "@/components/dashboard/dashboard-quick-actions";
import { ExecutiveKpiGrid } from "@/components/dashboard/executive-kpi-grid";
import { PartnerCompositionSection } from "@/components/dashboard/partner-composition-section";
import { PageHero } from "@/components/layout/page-hero";
import {
  ExecutivePipelineSummarySection,
  ExecutivePipelineTrendSection
} from "@/components/performance/executive-performance-section";
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

async function DashboardOverviewColumns() {
  const [stats, performanceStats] = await Promise.all([
    fetchDashboardRuntimeStats(),
    fetchExecutivePerformanceStats()
  ]);
  const currentYear = new Date().getFullYear();

  return (
    <div className="mt-4 grid items-start gap-4 xl:grid-cols-[0.92fr_1.48fr]">
      <div className="min-w-0 space-y-4">
        <AnimatedSection delayMs={60}>
          <ExecutiveKpiGrid compact stats={stats} currentYear={currentYear} />
        </AnimatedSection>

        <AnimatedSection delayMs={110}>
          <ExecutivePipelineSummarySection compact stats={performanceStats} />
        </AnimatedSection>

        <AnimatedSection delayMs={150}>
          <DashboardQuickActions />
        </AnimatedSection>
      </div>

      <div className="min-w-0 space-y-4">
        <AnimatedSection delayMs={90}>
          <PartnerCompositionSection compact stats={stats} />
        </AnimatedSection>

        <AnimatedSection delayMs={140}>
          <ExecutivePipelineTrendSection compact stats={performanceStats} />
        </AnimatedSection>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<SectionSkeleton height="h-24" />}>
        <DashboardHero />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-[44rem]" />}>
        <DashboardOverviewColumns />
      </Suspense>
    </>
  );
}
