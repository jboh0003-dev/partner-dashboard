import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StorageOptimizationPanel } from "@/components/documents/storage-optimization-panel";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function StorageOptimizationPage() {
  const auth = await requireAdmin();
  if (!auth.ok) redirect("/dashboard/documents");
  return (
    <>
      <PageHeader
        title="문서 용량 최적화"
        description="기존 문서의 절감 가능 용량을 분석하고, 다운로드·해시 검증 후 안전하게 교체합니다."
      />
      <StorageOptimizationPanel />
    </>
  );
}
