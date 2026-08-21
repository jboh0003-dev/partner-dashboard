import { PageHero } from "@/components/layout/page-hero";
import { ExecutivePerformanceSection } from "@/components/performance/executive-performance-section";
import { PerformanceDetailPanel } from "@/components/performance/performance-detail-panel";
import { fetchExecutivePerformanceStats, fetchPerformanceOpportunities } from "@/lib/data/partner-performance";
import { getCachedViewerAuthContext } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const [{ isAdmin }, stats, detail] = await Promise.all([
    getCachedViewerAuthContext(),
    fetchExecutivePerformanceStats(),
    fetchPerformanceOpportunities()
  ]);

  return (
    <>
      <PageHero
        compact
        title="실적/파이프라인"
        description="파트너 전체 영업기회와 수주 예상 프로젝트, 2025 매출을 조회합니다."
      />
      <ExecutivePerformanceSection stats={stats} />
      <PerformanceDetailPanel
        snapshot={detail.snapshot}
        opportunities={detail.opportunities}
        stats={stats}
        isAdmin={isAdmin}
      />
    </>
  );
}
