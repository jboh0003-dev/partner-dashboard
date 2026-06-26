import { PageHero } from "@/components/layout/page-hero";
import { PerformanceUploadPanel } from "@/components/performance/performance-upload-panel";

export default function PerformanceUploadPage() {
  return (
    <>
      <PageHero
        compact
        title="실적/파이프라인 업로드"
        description="오케스트로 파트너 관리 엑셀을 업로드해 파이프라인 스냅샷을 등록합니다."
      />
      <PerformanceUploadPanel />
    </>
  );
}
