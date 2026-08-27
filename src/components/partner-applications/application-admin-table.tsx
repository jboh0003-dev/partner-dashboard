"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { ApplicationStatusBadge } from "@/components/partner-applications/application-status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import type { PreReviewResult } from "@/lib/partner-applications/pre-review";

export type ApplicationAdminListRow = {
  id: string;
  application_number: string;
  company_name: string | null;
  business_registration_number: string | null;
  applicant_name: string | null;
  contact_name: string | null;
  submitted_at: string | null;
  created_at: string | null;
  status: string;
  missing_required_count: number | null;
  approved_partner_id?: string | null;
};

export function ApplicationAdminTable({
  rows,
  reviewById
}: {
  rows: ApplicationAdminListRow[];
  reviewById: Record<string, PreReviewResult | null>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runDelete(row: ApplicationAdminListRow) {
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/admin/partner-applications/${row.id}`, { method: "DELETE" });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setPendingId(null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "신청서 삭제에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      {error ? (
        <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">{error}</p>
      ) : null}
      <div className="ui-table-shell overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="ui-table-head">
            <tr>
              <th className="ui-table-cell">신청번호</th>
              <th className="ui-table-cell">기업명</th>
              <th className="ui-table-cell">상태</th>
              <th className="ui-table-cell">신청자</th>
              <th className="ui-table-cell">신청일</th>
              <th className="ui-table-cell">누락</th>
              <th className="ui-table-cell text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="ui-table-row border-t border-slate-100">
                <td className="ui-table-cell font-medium">
                  <Link className="text-okestro-700 hover:underline" href={`/dashboard/partner-applications/${row.id}`}>
                    {row.application_number}
                  </Link>
                </td>
                <td className="ui-table-cell">
                  <p className="font-medium text-slate-900">{row.company_name || "작성 중"}</p>
                  <p className="text-xs text-slate-500">{row.business_registration_number || "-"}</p>
                </td>
                <td className="ui-table-cell">
                  <ApplicationStatusBadge
                    dbStatus={row.status}
                    preReview={reviewById[row.id] ?? null}
                    showAiMark
                  />
                </td>
                <td className="ui-table-cell">{row.applicant_name || row.contact_name || "-"}</td>
                <td className="ui-table-cell tabular-nums">
                  {row.submitted_at
                    ? new Date(row.submitted_at).toLocaleDateString("ko-KR")
                    : row.created_at
                      ? `작성 ${new Date(row.created_at).toLocaleDateString("ko-KR")}`
                      : "-"}
                </td>
                <td className="ui-table-cell tabular-nums">{row.missing_required_count ?? 0}</td>
                <td className="ui-table-cell">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/dashboard/partner-applications/${row.id}`}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      검토
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPendingId(row.id)}
                      className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8">
                  <EmptyState
                    compact
                    title="신청 내역이 없습니다"
                    description="제출·작성 중인 신청이 없습니다. 테스트 작성분도 여기서 정리할 수 있습니다."
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(pendingId)}
        title="신청서 삭제"
        message={
          pendingRow(rows, pendingId)?.approved_partner_id
            ? "이 신청서를 삭제합니다. 이미 승인되어 등록된 파트너 DB는 삭제되지 않습니다. 신청 첨부파일만 함께 정리됩니다."
            : "작성 중이거나 제출된 신청서를 삭제합니다. 연결된 첨부파일도 함께 정리됩니다."
        }
        confirmLabel="삭제"
        danger
        loading={isPending}
        onCancel={() => setPendingId(null)}
        onConfirm={() => {
          const row = pendingRow(rows, pendingId);
          if (row) runDelete(row);
        }}
      />
    </>
  );
}

function pendingRow(rows: ApplicationAdminListRow[], id: string | null) {
  return rows.find((row) => row.id === id) ?? null;
}
