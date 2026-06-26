"use client";

import { useMemo } from "react";
import { TableCopyToolbar } from "@/components/common/table-copy-toolbar";
import { useTableSelection } from "@/hooks/use-table-selection";
import {
  TECH_PARTNER_PARTICIPANT_SELECTED_ROW_TSV,
  techPartnerParticipantToCopyable
} from "@/lib/clipboard/row-mappers";
import type { TechPartnerParticipantRecord } from "@/lib/imports/tech-partner-training";

type TechPartnerParticipantsCopyTableProps = {
  rows: TechPartnerParticipantRecord[];
  showReviewActions?: boolean;
  onPartnerOverride?: (key: string, partnerId: string, partnerName: string) => void;
  onExclude?: (key: string) => void;
  getReviewDisplay?: (row: TechPartnerParticipantRecord) => string[];
};

export function TechPartnerParticipantsCopyTable({
  rows,
  showReviewActions = false,
  onPartnerOverride,
  onExclude,
  getReviewDisplay
}: TechPartnerParticipantsCopyTableProps) {
  const selection = useTableSelection(rows, (row) => row.key);
  const copyableRows = useMemo(() => rows.map(techPartnerParticipantToCopyable), [rows]);

  return (
    <>
      <TableCopyToolbar
        allRows={copyableRows}
        selectedIds={selection.selectedIds}
        selectedCount={selection.selectedCount}
        filterResultCount={rows.length}
        onClearSelection={selection.clearSelection}
        selectedRowTsv={TECH_PARTNER_PARTICIPANT_SELECTED_ROW_TSV}
      />
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm select-none">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="w-10 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selection.allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = selection.someSelected;
                  }}
                  onChange={selection.toggleAll}
                  aria-label="현재 목록 전체 선택"
                  className="h-4 w-4 rounded border-slate-300"
                />
              </th>
              <th className="px-4 py-3 text-left">파트너사</th>
              <th className="px-4 py-3 text-left">이름</th>
              <th className="px-4 py-3 text-left">직급</th>
              <th className="px-4 py-3 text-left">전화</th>
              <th className="px-4 py-3 text-right">출석</th>
              <th className="px-4 py-3 text-center">응시</th>
              <th className="px-4 py-3 text-right">총점</th>
              <th className="px-4 py-3 text-right">환산</th>
              <th className="px-4 py-3 text-left">상태</th>
              {showReviewActions ? <th className="px-4 py-3 text-left">조치</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-3 py-3 align-top">
                  <input
                    type="checkbox"
                    checked={selection.selectedIds.has(row.key)}
                    onChange={() => selection.toggleRow(row.key)}
                    aria-label={`${row.participant_name} 선택`}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </td>
                <td className="px-4 py-3">{row.matched_partner_name ?? row.company_name}</td>
                <td className="px-4 py-3">{row.participant_name}</td>
                <td className="px-4 py-3">{row.title ?? "-"}</td>
                <td className="px-4 py-3">{row.phone ?? "-"}</td>
                <td className="px-4 py-3 text-right">{row.attendance_days ?? "-"}</td>
                <td className="px-4 py-3 text-center">{row.exam_status}</td>
                <td className="px-4 py-3 text-right">{row.total_score ?? "-"}</td>
                <td className="px-4 py-3 text-right">{row.converted_score ?? "-"}</td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div className="space-y-1">
                    {(getReviewDisplay?.(row) ?? (row.review_reason ? [row.review_reason] : [])).map(
                      (line) => (
                        <p key={line}>{line}</p>
                      )
                    )}
                    {row.correction_applied ? (
                      <p className="font-medium text-emerald-700">보정 완료 — 저장 가능</p>
                    ) : (
                      <p className="text-slate-500">{row.match_status}</p>
                    )}
                    {row.attendance_scope ? (
                      <p className="text-slate-500">참석 범위: {row.attendance_scope}</p>
                    ) : null}
                  </div>
                </td>
                {showReviewActions ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.partner_candidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          className="rounded border border-slate-200 px-2 py-1 text-[11px]"
                          onClick={() =>
                            onPartnerOverride?.(row.key, candidate.id, candidate.company_name)
                          }
                        >
                          {candidate.company_name}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700"
                        onClick={() => onExclude?.(row.key)}
                      >
                        제외
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
