import { PageHero } from "@/components/layout/page-hero";
import { PolicyUploadPanel } from "@/components/policy/policy-upload-panel";

export default function PolicyUploadPage() {
  return (
    <>
      <PageHero
        compact
        title="파트너 정책 업로드"
        description="정책 PPT/PDF를 업로드하고 버전별로 관리합니다. 최신 정책이 파트너 정책 화면과 오케 AI에 반영됩니다."
      />
      <PolicyUploadPanel />
    </>
  );
}
