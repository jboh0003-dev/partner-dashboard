import { PageHeader } from "@/components/layout/page-header";
import { Verified2026DocumentUpload } from "@/components/upload/verified-2026-document-upload";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Verified2026DocumentsPage() {
  const auth = await requireAdmin();

  if (!auth.ok) {
    return (
      <>
        <PageHeader title="2026 파트너 문서 반영" description="관리자 전용 문서 반영 화면입니다." />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
          관리자 권한이 필요합니다.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="2026 파트너 문서 반영"
        description="사전 검증된 2026년 제출자료를 Partner Connect에 일괄 반영합니다."
      />
      <Verified2026DocumentUpload />
    </>
  );
}
