import { EmptyState } from "@/components/common/empty-state";
import { POC_RESULT_STATUS_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import type { PartnerPoc } from "@/types/poc";

export function PartnerPocsPanel({ pocs }: { pocs: PartnerPoc[] }) {
  if (pocs.length === 0) {
    return (
      <EmptyState
        title="등록된 PoC 이력이 없습니다."
        description="추후 데이터 연동 예정입니다. PoC 원천 데이터가 연결되면 이 영역에 프로젝트 이력·결과가 표시됩니다."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card">
      <table className="min-w-full divide-y divide-slate-100">
        <thead className="bg-slate-50/90">
          <tr>
            {["PoC명", "고객사", "제품", "기간", "역할", "결과", "요약"].map((label) => (
              <th key={label} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pocs.map((poc) => (
            <tr key={poc.id} className="hover:bg-slate-50/80">
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{poc.poc_name ?? "-"}</td>
              <td className="px-4 py-2.5 text-sm text-slate-700">{poc.customer_name ?? "-"}</td>
              <td className="px-4 py-2.5 text-sm text-slate-700">{poc.product_name ?? "-"}</td>
              <td className="px-4 py-2.5 text-sm tabular-nums text-slate-700">
                {formatPeriod(poc.start_date, poc.end_date)}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-700">{poc.role_description ?? "-"}</td>
              <td className="px-4 py-2.5 text-sm">
                {poc.result_status ? (
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {POC_RESULT_STATUS_LABEL[poc.result_status] ?? poc.result_status}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="max-w-[280px] px-4 py-2.5 text-sm text-slate-600">
                {poc.result_summary ?? poc.memo ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "-";
  return `${start ? formatDate(start) : "-"} ~ ${end ? formatDate(end) : "-"}`;
}
