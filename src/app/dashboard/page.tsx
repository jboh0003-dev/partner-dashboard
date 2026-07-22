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

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDataAsOf(snapshotDate: string | null | undefined): string | null {
  if (!snapshotDate) return null;
  const date = new Date(snapshotDate);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

export default async function DashboardPage() {
  const [stats, performanceStats] = await Promise.all([
    fetchDashboardStats(),
    fetchExecutivePerformanceStats()
  ]);
  const currentYear = new Date().getFullYear();
  const dataAsOf = formatDataAsOf(performanceStats.latest_snapshot?.snapshot_date);

  return (
    <>
      <PageHero
        compact
        title="파트너 운영 현황"
        description="파트너 운영 핵심 지표와 2026 파이프라인 현황을 한눈에 확인합니다."
        action={
          dataAsOf ? (
            <p className="rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-slate-100 ring-1 ring-inset ring-white/20">
              데이터 기준일 {dataAsOf}
            </p>
          ) : null
        }
      />

      <ExecutiveKpiGrid stats={stats} currentYear={currentYear} />

      <ExecutivePipelineSummarySection stats={performanceStats} />

      <ExecutivePipelineTrendSection stats={performanceStats} />

      <PartnerCompositionSection stats={stats} />

      <ExecutiveTopPartnersSection stats={performanceStats} />
    </>
  );
}
