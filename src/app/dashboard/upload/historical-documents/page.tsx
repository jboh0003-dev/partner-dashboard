import { PageHeader } from "@/components/layout/page-header";
import { HistoricalPartnerDocumentsUpload } from "@/components/upload/historical-partner-documents-upload";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function HistoricalPartnerDocumentsPage() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return (
      <>
        <PageHeader title="과거 파트너 문서 일괄 반영" description="관리자 전용 문서 반영 화면입니다." />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          관리자 권한이 필요합니다.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="과거 파트너 문서 일괄 반영"
        description="연도·분기·월별 ZIP 자료를 한 번에 정리해 Partner Connect에 반영합니다."
      />
      <HistoricalPartnerDocumentsUpload />
    </>
  );
}
