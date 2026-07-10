"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

type DocumentsToolbarProps = {
  isAdmin?: boolean;
};

/** 관리자 전용 — 문서 매칭 재검사·중복 정리 */
export function DocumentsToolbar({ isAdmin = false }: DocumentsToolbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  if (!isAdmin) {
    return null;
  }

  function handleReinspect() {
    startTransition(async () => {
      setMessage(null);
      setIsError(false);
      try {
        const response = await fetch("/api/admin/documents/reinspect", { method: "POST" });
        const json = await response.json();
        if (!response.ok || !json.ok) {
          throw new Error(json?.message ?? "문서 매칭 재검사에 실패했습니다.");
        }
        setMessage(`재검사 완료: ${json.updated}건 업데이트`);
        router.refresh();
      } catch (error) {
        setIsError(true);
        setMessage(error instanceof Error ? error.message : "문서 매칭 재검사에 실패했습니다.");
      }
    });
  }

  return (
    <div className="ui-toolbar mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleReinspect}
          disabled={isPending}
          className="ui-btn-secondary"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          문서 매칭 재검사
        </button>
        <Link href="/dashboard/documents/duplicates" className="ui-btn-secondary">
          문서 중복 정리
        </Link>
      </div>
      {message ? (
        <div
          className={[
            "flex w-full items-start gap-2 rounded-lg px-3 py-2 text-sm",
            isError ? "ui-error" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
          ].join(" ")}
        >
          {isError ? <AlertCircle size={16} className="mt-0.5 shrink-0" /> : null}
          <span>{message}</span>
        </div>
      ) : null}
    </div>
  );
}
