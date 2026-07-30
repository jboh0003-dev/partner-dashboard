import { Suspense } from "react";
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
    <div
      className={`mt-4 animate-pulse rounded-xl border border-slate-200 bg-slate-100/80 ${height}`}
      aria-hidden
    />
  );
}

function formatDataAsOf(snapshotDate: string | null | undefined): string | null {
  if (!snapshotDate) return null;
  const date = new Date(snapshotDate);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

async function DashboardHero() {
  const performanceStats = await fetchExecutivePerformanceStats();
  const dataAsOf = formatDataAsOf(performanceStats.latest_snapshot?.snapshot_date);
  return (
    <PageHero
      compact
      title="파트너 운영 현황"
      description="파트너 운영 핵심 지표와 2026 파이프라인 현황을 한눈에 확인합니다."
      action={
        dataAsOf ? (
          <p className="rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white ring-1 ring-inset ring-white/30">
            데이터 기준일 {dataAsOf}
          </p>
        ) : null
      }
    />
  );
}

async function DashboardKpiBlock() {
  const stats = await fetchDashboardStats();
  const currentYear = new Date().getFullYear();
  return <ExecutiveKpiGrid stats={stats} currentYear={currentYear} />;
}

async function DashboardPipelineSummaryBlock() {
  const performanceStats = await fetchExecutivePerformanceStats();
  return <ExecutivePipelineSummarySection stats={performanceStats} />;
}

async function DashboardDeferredCharts() {
  const [stats, performanceStats] = await Promise.all([
    fetchDashboardStats(),
    fetchExecutivePerformanceStats()
  ]);
  return (
    <>
      <ExecutivePipelineTrendSection stats={performanceStats} />
      <PartnerCompositionSection stats={stats} />
      <ExecutiveTopPartnersSection stats={performanceStats} />
    </>
  );
}

export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<SectionSkeleton height="h-28" />}>
        <DashboardHero />
      </Suspense>

      <Suspense fallback={<SectionSkeleton height="h-36" />}>
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
