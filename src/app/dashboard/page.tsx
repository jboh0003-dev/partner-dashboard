import { Suspense } from "react";
import { AnimatedSection } from "@/components/common/animated-section";
import { KpiGridSkeleton, Skeleton } from "@/components/common/skeleton";
import { PageHero } from "@/components/layout/page-hero";
import { ExecutiveKpiGrid } from "@/components/dashboard/executive-kpi-grid";
import { PartnerCompositionSection } from "@/components/dashboard/partner-composition-section";
import {
  ExecutivePipelineSummarySection,
  ExecutivePipelineTrendSection,
  ExecutiveTopPartnersSection
} from "@/components/performance/executive-performance-section";
import { fetchDashboardStats } from "@/lib/data/dashboard";
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
        title="OKESTRO Partner Portal"
        description="파트너 정보·계약·교육·실적 데이터를 통합 관리하는 AI 기반 운영 대시보드"
      />
    </AnimatedSection>
  );
}

async function DashboardKpiBlock() {
  const stats = await fetchDashboardStats();
  const currentYear = new Date().getFullYear();
  return (
    <AnimatedSection delayMs={60} className="mt-4">
      <ExecutiveKpiGrid stats={stats} currentYear={currentYear} />
    </AnimatedSection>
  );
}

async function DashboardPipelineSummaryBlock() {
  const performanceStats = await fetchExecutivePerformanceStats();
  return (
    <AnimatedSection delayMs={120} className="mt-4">
      <ExecutivePipelineSummarySection stats={performanceStats} />
    </AnimatedSection>
  );
}

async function DashboardDeferredCharts() {
  const [stats, performanceStats] = await Promise.all([
    fetchDashboardStats(),
    fetchExecutivePerformanceStats()
  ]);
  return (
    <div className="mt-4 space-y-4">
      <AnimatedSection delayMs={40}>
        <ExecutivePipelineTrendSection stats={performanceStats} />
      </AnimatedSection>
      <AnimatedSection delayMs={90}>
        <PartnerCompositionSection stats={stats} />
      </AnimatedSection>
      <AnimatedSection delayMs={140}>
        <ExecutiveTopPartnersSection stats={performanceStats} />
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

      <Suspense
        fallback={
          <div className="mt-4">
            <KpiGridSkeleton />
          </div>
        }
      >
        <DashboardKpiBlock />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-48" />}>
        <DashboardPipelineSummaryBlock />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-64" />}>
        <DashboardDeferredCharts />
      </Suspense>
    </>
  );
}
