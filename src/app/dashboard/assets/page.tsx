import { AssetsPartnerTable } from "@/components/assets/assets-partner-table";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CsvDownloadButton } from "@/components/common/csv-download-button";
import {
  fetchAssetPartnerSummaries,
  fetchAssetStatusOptions,
  fetchAssetTypeOptions
} from "@/lib/data/assets";
import { formatAssetUpdatedAt } from "@/lib/assets/display";

type SearchParams = {
  q?: string;
  nodeType?: string;
  grade?: string;
  status?: string;
  review?: string;
};

export default async function AssetsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const grade = params.grade ?? "platinum";
  const [{ rows, error }, typeOptions, statusOptions] = await Promise.all([
    fetchAssetPartnerSummaries({
      q: params.q,
      nodeType: params.nodeType,
      grade,
      status: params.status,
      review: params.review
    }),
    fetchAssetTypeOptions(),
    fetchAssetStatusOptions()
  ]);

  const exportRows = rows.map((row) => ({
    파트너사: row.partner_name,
    등급: row.partner_grade_label,
    장비상태: row.asset_status ?? "",
    "컨트롤 노드": row.control_node_label,
    "컴퓨터 노드": row.compute_node_label,
    "대표 CPU": row.representative_cpu ?? "",
    "대표 Memory": row.representative_memory ?? "",
    "대표 OS Disk": row.representative_os_disk ?? "",
    "대표 Ceph Disk": row.representative_ceph_disk ?? "",
    "대표 NIC": row.representative_nic ?? "",
    "최종 업데이트": row.latest_updated_at ? formatAssetUpdatedAt({
      last_synced_at: row.latest_updated_at,
      updated_at: row.latest_updated_at,
      created_at: row.latest_updated_at
    }) : ""
  }));

  return (
    <>
      <PageHeader
        title="장비/리소스"
        description="파트너사별 장비 보유 현황을 조회합니다. 행을 펼치면 노드별 상세 스펙을 확인할 수 있습니다."
        action={<CsvDownloadButton rows={exportRows} filenamePrefix="partner-equipment" />}
      />

      <form className="mb-5 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-nowrap">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="파트너사, CPU, Memory, NIC 검색"
          className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600"
        />
        <select
          name="grade"
          defaultValue={grade}
          className="w-40 shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="strategic">Strategic</option>
          <option value="all">전체 등급</option>
        </select>
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="w-40 shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체 장비상태</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          name="nodeType"
          defaultValue={params.nodeType ?? "all"}
          className="w-40 shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체 노드유형</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select
          name="review"
          defaultValue={params.review ?? "all"}
          className="w-40 shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체 매칭</option>
          <option value="only">검토 필요만</option>
        </select>
        <button className="shrink-0 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          검색
        </button>
      </form>

      <div className="mb-3 text-xs text-slate-500">
        총 <span className="font-semibold text-slate-700">{rows.length}</span>개 파트너사
        {grade === "platinum" ? (
          <span className="ml-1 text-slate-400">(기본: Platinum 파트너)</span>
        ) : null}
      </div>

      {error ? (
        <EmptyState title="장비 목록을 불러오지 못했습니다." description={error.message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="등록된 장비 정보가 없습니다."
          description="엑셀 업로드 화면에서 장비현황 파일을 업로드하면 여기에 표시됩니다."
        />
      ) : (
        <AssetsPartnerTable rows={rows} />
      )}
    </>
  );
}
