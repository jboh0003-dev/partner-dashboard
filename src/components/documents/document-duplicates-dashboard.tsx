"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getDocumentTypeShortLabel } from "@/lib/documents/display";
import { DUPLICATE_REASON, type DuplicateGroup } from "@/lib/documents/duplicate-detection";
import { formatDate } from "@/lib/utils";

type DuplicateDashboardProps = {
  initialGroups: DuplicateGroup[];
  initialSummary: {
    total_candidates: number;
    exact: number;
    near: number;
    hidden: number;
    near_review: number;
  };
};

export function DocumentDuplicatesDashboard({
  initialGroups,
  initialSummary
}: DuplicateDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scanSummary, setScanSummary] = useState<{
    exact_hidden: number;
    near_candidates: number;
    excluded: number;
    groups: number;
    scanned: number;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function runScan() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/admin/documents/duplicates", { method: "POST" });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        setMessage(json.message ?? "중복 검사 실패");
        return;
      }
      setScanSummary(json.summary);
      router.refresh();
    });
  }

  async function runAction(input: {
    action: "representative" | "hide_duplicate" | "not_duplicate";
    document_id: string;
    duplicate_of?: string;
  }) {
    setMessage(null);
    const response = await fetch("/api/admin/documents/duplicates/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const json = await response.json();
    if (!response.ok || !json.ok) {
      setMessage(json.message ?? "처리 실패");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">관리자용 문서 중복 정리</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Storage 파일과 DB row는 삭제하지 않습니다. 완전 중복만 자동 숨김 처리하고, 준중복은
          확인 후 대표 문서를 지정하세요.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={runScan}
          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {isPending ? "검사 중..." : "중복 문서 검사"}
        </button>
        <Link
          href="/dashboard/documents"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
        >
          문서 관리로 이동
        </Link>
      </div>

      {scanSummary ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-semibold">검사 결과</p>
          <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <li>스캔 문서: {scanSummary.scanned}건</li>
            <li>완전 중복 숨김: {scanSummary.exact_hidden}건</li>
            <li>확인 필요 준중복: {scanSummary.near_candidates}그룹</li>
            <li>정상 복수 제외: {scanSummary.excluded}그룹</li>
          </ul>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {message}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="중복 후보 그룹" value={initialSummary.total_candidates} />
        <SummaryCard label="완전 중복" value={initialSummary.exact} tone="rose" />
        <SummaryCard label="준중복" value={initialSummary.near} tone="amber" />
        <SummaryCard label="숨김 문서" value={initialSummary.hidden} />
        <SummaryCard label="확인 필요" value={initialSummary.near_review} tone="amber" />
      </section>

      {initialGroups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          현재 중복 후보 그룹이 없습니다. 「중복 문서 검사」를 실행해 기존 데이터를 정리할 수
          있습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {initialGroups.map((group) => (
            <DuplicateGroupCard key={group.key} group={group} onAction={runAction} />
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicateGroupCard({
  group,
  onAction
}: {
  group: DuplicateGroup;
  onAction: (input: {
    action: "representative" | "hide_duplicate" | "not_duplicate";
    document_id: string;
    duplicate_of?: string;
  }) => Promise<void>;
}) {
  const representativeId = group.representative_id ?? group.documents[0]?.id;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">{group.partner_name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {getDocumentTypeShortLabel(group.document_type)} · {group.documents.length}건 ·{" "}
              {group.classification === "exact"
                ? "완전 중복"
                : group.classification === "near"
                  ? "준중복 확인 필요"
                  : "기타"}
            </p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {group.documents.map((doc) => (
          <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {doc.display_name ?? doc.original_filename ?? doc.file_name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {doc.original_filename ?? "-"} · {formatDate(doc.created_at)}
                {doc.file_size ? ` · ${Math.round(doc.file_size / 1024)}KB` : ""}
              </p>
              {doc.duplicate_reason === DUPLICATE_REASON.near_candidate ? (
                <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  확인 필요
                </span>
              ) : null}
              {doc.is_duplicate ? (
                <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  숨김
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onAction({ action: "representative", document_id: doc.id })}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
              >
                대표 지정
              </button>
              {representativeId && doc.id !== representativeId ? (
                <button
                  type="button"
                  onClick={() =>
                    void onAction({
                      action: "hide_duplicate",
                      document_id: doc.id,
                      duplicate_of: representativeId
                    })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  중복 숨김
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void onAction({ action: "not_duplicate", document_id: doc.id })}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800"
              >
                중복 아님
              </button>
              <Link
                href={`/dashboard/partners/${group.partner_id}?tab=documents`}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                파트너 문서
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: number;
  tone?: "slate" | "amber" | "rose";
}) {
  const toneClass =
    tone === "amber" ? "text-amber-700" : tone === "rose" ? "text-rose-700" : "text-slate-950";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>
        {value.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}
