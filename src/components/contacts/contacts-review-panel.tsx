"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";

export type ReviewContactRow = {
  id: string;
  partner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  review_reason: string | null;
  company_name: string;
  partner_no: string | null;
};

export function ContactsReviewPanel({ rows }: { rows: ReviewContactRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mergeTargetById, setMergeTargetById] = useState<Record<string, string>>({});

  function runAction(contactId: string, action: "keep_active" | "deactivate" | "merge" | "delete") {
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/contacts/${contactId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          merge_target_id: action === "merge" ? mergeTargetById[contactId] : undefined
        })
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "처리에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="검토 필요 담당자가 없습니다."
        description="전체DB 업로드 후 누락된 인원이 있으면 여기에 표시됩니다."
      />
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2.5">회사명</th>
              <th className="px-4 py-2.5">이름</th>
              <th className="px-4 py-2.5">이메일</th>
              <th className="px-4 py-2.5">사유</th>
              <th className="px-4 py-2.5 text-right">조치</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link href={`/dashboard/partners/${row.partner_id}`} className="text-okestro-600 hover:underline">
                    {row.company_name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-medium">{row.name}</td>
                <td className="px-4 py-2.5">{row.email ?? "-"}</td>
                <td className="px-4 py-2.5 text-slate-600">{row.review_reason ?? "-"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <ReviewButton disabled={isPending} onClick={() => runAction(row.id, "keep_active")}>
                      현재 인력 유지
                    </ReviewButton>
                    <ReviewButton disabled={isPending} onClick={() => runAction(row.id, "deactivate")}>
                      비활성
                    </ReviewButton>
                    <ReviewButton
                      disabled={isPending || !mergeTargetById[row.id]?.trim()}
                      onClick={() => runAction(row.id, "merge")}
                    >
                      병합
                    </ReviewButton>
                    <ReviewButton danger disabled={isPending} onClick={() => runAction(row.id, "delete")}>
                      삭제
                    </ReviewButton>
                  </div>
                  <input
                    type="text"
                    placeholder="병합 대상 contact UUID"
                    value={mergeTargetById[row.id] ?? ""}
                    onChange={(event) =>
                      setMergeTargetById((prev) => ({ ...prev, [row.id]: event.target.value }))
                    }
                    className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReviewButton({
  children,
  onClick,
  disabled,
  danger = false
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:opacity-50",
        danger
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-slate-200 bg-white text-slate-700 hover:border-blue-400"
      ].join(" ")}
    >
      {children}
    </button>
  );
}
