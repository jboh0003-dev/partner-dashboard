import { PageHero } from "@/components/layout/page-hero";
import { ExecutivePerformanceSection } from "@/components/performance/executive-performance-section";
import { PerformanceDetailPanel } from "@/components/performance/performance-detail-panel";
import { fetchExecutivePerformanceStats, fetchPerformanceOpportunities } from "@/lib/data/partner-performance";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const [stats, detail] = await Promise.all([
    fetchExecutivePerformanceStats(),
    fetchPerformanceOpportunities()
  ]);

  return (
    <>
      <PageHero
        compact
        title="실적/파이프라인"
        description="파트너 수주예상·신규등록 파이프라인과 매출 실적을 임원 보고용으로 조회합니다."
      />
      <ExecutivePerformanceSection stats={stats} />
      <PerformanceDetailPanel snapshot={detail.snapshot} opportunities={detail.opportunities} />
    </>
  );
}
