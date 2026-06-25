import { PocsListTable } from "@/components/pocs/pocs-list-table";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CsvDownloadButton } from "@/components/common/csv-download-button";
import { POC_RESULT_STATUS_LABEL } from "@/lib/constants";
import { fetchPocFilterOptions, fetchPocList } from "@/lib/data/pocs";

type SearchParams = {
  q?: string;
  status?: string;
  product?: string;
};

export default async function PocsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [{ rows, error }, { statuses, products }] = await Promise.all([
    fetchPocList({
      q: params.q,
      status: params.status,
      product: params.product
    }),
    fetchPocFilterOptions()
  ]);

  const exportRows = rows.map((row) => ({
    파트너사: row.partner_name,
    PoC명: row.poc_name,
    고객사: row.customer_name,
    제품: row.product_name,
    시작일: row.start_date,
    종료일: row.end_date,
    역할: row.role_description,
    결과: row.result_status
      ? POC_RESULT_STATUS_LABEL[row.result_status] ?? row.result_status
      : null,
    결과요약: row.result_summary,
    메모: row.memo
  }));

  return (
    <>
      <PageHeader
        title="PoC 현황"
        description="파트너사별 PoC 프로젝트 이력을 조회합니다."
        action={<CsvDownloadButton rows={exportRows} filenamePrefix="partner-pocs" />}
      />

      <form className="mb-5 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-nowrap">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="파트너사, PoC명, 고객사, 제품 검색"
          className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600"
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="w-40 shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체 결과</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {POC_RESULT_STATUS_LABEL[status] ?? status}
            </option>
          ))}
        </select>
        <select
          name="product"
          defaultValue={params.product ?? "all"}
          className="w-44 shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체 제품</option>
          {products.map((product) => (
            <option key={product} value={product}>
              {product}
            </option>
          ))}
        </select>
        <button className="shrink-0 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          검색
        </button>
      </form>

      <div className="mb-3 text-xs text-slate-500">
        총 <span className="font-semibold text-slate-700">{rows.length}</span>건
      </div>

      {error ? (
        <EmptyState title="PoC 목록을 불러오지 못했습니다." description={error.message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="등록된 PoC 이력이 없습니다."
          description="partner_pocs 테이블에 데이터를 추가하면 여기에 표시됩니다."
        />
      ) : (
        <PocsListTable rows={rows} />
      )}
    </>
  );
}
