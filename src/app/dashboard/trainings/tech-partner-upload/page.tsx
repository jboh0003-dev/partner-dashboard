import { PageHeader } from "@/components/layout/page-header";
import { TechPartnerUploadPanel } from "@/components/trainings/tech-partner-upload-panel";

export default function TechPartnerUploadPage() {
  return (
    <>
      <PageHeader
        title="기술파트너 교육 업로드"
        description="교육 출석 + 이론평가 + 기술평가 결과를 반영합니다. 일반 정기교육 참석자 업로드와는 별도입니다."
      />
      <TechPartnerUploadPanel />
    </>
  );
}
