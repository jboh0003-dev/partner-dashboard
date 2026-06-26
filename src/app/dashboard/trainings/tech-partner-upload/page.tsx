import { PageHeader } from "@/components/layout/page-header";
import { TechPartnerUploadPanel } from "@/components/trainings/tech-partner-upload-panel";

export default function TechPartnerUploadPage() {
  return (
    <>
      <PageHeader
        title="기술파트너 교육 업로드"
        description="2026년 상반기 기술파트너 교육 시험결과와 교육생 관리대장을 업로드합니다."
      />
      <TechPartnerUploadPanel />
    </>
  );
}
