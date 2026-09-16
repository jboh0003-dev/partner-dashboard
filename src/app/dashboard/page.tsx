import { Suspense } from "react";
import { AnimatedSection } from "@/components/common/animated-section";
import { Skeleton } from "@/components/common/skeleton";
import { PageHero } from "@/components/layout/page-hero";
import { ExecutiveKpiGrid } from "@/components/dashboard/executive-kpi-grid";
import { PartnerCompositionSection } from "@/components/dashboard/partner-composition-section";
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
          <>
            OKESTRO Partner{" "}
            <span className="bg-gradient-to-r from-sky-300 via-blue-300 to-cyan-200 bg-clip-text font-black italic tracking-[-0.045em] text-transparent">
              Connect
            </span>
          </>
        }
        description="파트너 정보·담당자·교육·문서·실적을 하나의 흐름으로 연결하고, Partner Agent로 자연어 조회할 수 있습니다."
      />
    </AnimatedSection>
  );
}

async function DashboardPartnerOverviewBlock() {
  const stats = await fetchDashboardRuntimeStats();
  const currentYear = new Date().getFullYear();

  return (
    <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[0.92fr_1.48fr]">
      <AnimatedSection delayMs={60}>
        <ExecutiveKpiGrid compact stats={stats} currentYear={currentYear} />
      </AnimatedSection>
      <AnimatedSection delayMs={90}>
        <PartnerCompositionSection compact stats={stats} />
      </AnimatedSection>
    </div>
  );
}

async function DashboardPipelineBlock() {
  const performanceStats = await fetchExecutivePerformanceStats();

  return (
    <div className="mt-4 grid items-stretch gap-4 xl:grid-cols-[0.92fr_1.48fr]">
      <AnimatedSection delayMs={110}>
        <ExecutivePipelineSummarySection compact stats={performanceStats} />
      </AnimatedSection>
      <AnimatedSection delayMs={140}>
        <ExecutivePipelineTrendSection compact stats={performanceStats} />
      </AnimatedSection>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<SectionSkeleton height="h-28" />}>
        <DashboardHero />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-[21rem]" />}>
        <DashboardPartnerOverviewBlock />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-[20rem]" />}>
        <DashboardPipelineBlock />
      </Suspense>
    </>
  );
}
