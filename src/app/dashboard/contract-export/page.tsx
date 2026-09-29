import { PageHeader } from "@/components/layout/page-header";
import { ContractStatusExportPanel } from "@/components/partners/contract-status-export-panel";
import { requireContractExportPage } from "@/lib/auth/contract-export";
import {
  CONTRACT_STATUS_HEADERS,
  fetchContractStatusExportIndexRows
} from "@/lib/partners/contract-status-export";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ContractExportPage() {
  await requireContractExportPage();
  const rows = await fetchContractStatusExportIndexRows(createAdminClient());

  return (
    <div className="p-6">
      <PageHeader
        title="파트너 계약현황 추출"
        description="로컬 '1.파트너계약현황' A:AQ 순서로 언제든 복사할 수 있는 개인 관리자 도구입니다."
      />
      <ContractStatusExportPanel headers={CONTRACT_STATUS_HEADERS} rows={rows} />
    </div>
  );
}
