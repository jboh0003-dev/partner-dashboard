import { PageHeader } from "@/components/layout/page-header";
import { DocumentDuplicatesDashboard } from "@/components/documents/document-duplicates-dashboard";
import { fetchDuplicateGroupsForAdmin } from "@/lib/data/document-duplicates";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DocumentDuplicatesPage() {
  const { groups, summary } = await fetchDuplicateGroupsForAdmin();

  return (
    <>
      <PageHeader
        title="문서 중복 정리"
        description="파트너 문서의 완전 중복·준중복을 검사하고 대표 문서를 지정합니다. Storage와 DB row는 삭제하지 않습니다."
      />
      <DocumentDuplicatesDashboard initialGroups={groups} initialSummary={summary} />
    </>
  );
}
