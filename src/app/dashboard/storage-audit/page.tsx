"use client";

import { useState } from "react";
import { Download, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

type ClassificationRow = { count: number; bytes: number; label: string };

type AuditUiSummary = {
  generated_at: string;
  bucket: string;
  totals: { storage_files: number; storage_bytes: number; db_documents: number };
  totals_label: { storage: string; reclaim: string };
  by_classification_label: Record<string, ClassificationRow>;
  by_document_type: Array<{
    document_type: string;
    label: string;
    count: number;
    bytes: number;
    bytes_label: string;
  }>;
  items_count: number;
  safe_delete_candidates: Array<{ storage_path: string | null; size_bytes: number }>;
  estimated_reclaim_bytes: number;
};

type FullAudit = {
  generated_at: string;
  bucket: string;
  items: unknown[];
  safe_delete_candidates: Array<{ storage_path: string | null }>;
};

const CLASS_LABEL: Record<string, string> = {
  linked_ok: "정상 연결",
  orphan_storage: "고아 Storage",
  missing_storage: "Storage 유실",
  exact_duplicate: "확정 중복",
  version_candidate: "버전 후보",
  temp_or_test: "임시/테스트",
  deleted_partner: "삭제 파트너 연결",
  manual_review: "수동 검토"
};

export default function StorageAuditPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AuditUiSummary | null>(null);
  const [full, setFull] = useState<FullAudit | null>(null);

  async function runAudit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/storage/audit");
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "진단 실패");
      }
      setSummary(json.summary as AuditUiSummary);
      setFull(json.full as FullAudit);
    } catch (e) {
      setError(e instanceof Error ? e.message : "진단 실패");
    } finally {
      setLoading(false);
    }
  }

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    if (!full?.items) return;
    const rows = full.items as Array<Record<string, unknown>>;
    const headers = [
      "classification",
      "deletable",
      "reason",
      "storage_path",
      "document_id",
      "partner_id",
      "partner_name",
      "document_type",
      "size_bytes",
      "created_at",
      "keep_path"
    ];
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const raw = String(row[h] ?? "");
            return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
          })
          .join(",")
      )
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storage-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Storage 진단"
        action={
          <button
            type="button"
            onClick={runAudit}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-okestro-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-okestro-800 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            진단 실행
          </button>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <ShieldAlert size={18} className="mt-0.5 shrink-0" />
        <p>
          이 화면은 dry-run 진단만 수행합니다. 웹에서 파일 삭제는 불가하며, 승인된 manifest로
          CLI(<code className="rounded bg-amber-100 px-1">npm run storage:cleanup</code>)만
          삭제합니다.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {!summary ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          진단 실행을 누르면 partner-documents bucket을 분석합니다.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Storage 파일 수" value={summary.totals.storage_files.toLocaleString("ko-KR")} />
            <StatCard label="총 용량" value={summary.totals_label.storage} />
            <StatCard label="DB 문서 수" value={summary.totals.db_documents.toLocaleString("ko-KR")} />
            <StatCard
              label="안전 삭제 후보 용량"
              value={summary.totals_label.reclaim}
              hint={`${summary.safe_delete_candidates.length}건`}
            />
          </div>

          <p className="text-xs text-slate-500">마지막 진단: {summary.generated_at}</p>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">분류별</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">분류</th>
                    <th className="py-2 pr-4">건수</th>
                    <th className="py-2">용량</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.by_classification_label).map(([key, row]) =>
                    row.count === 0 ? null : (
                      <tr key={key} className="border-t border-slate-100">
                        <td className="py-2 pr-4 font-medium text-slate-800">
                          {CLASS_LABEL[key] ?? key}
                        </td>
                        <td className="py-2 pr-4 tabular-nums">{row.count.toLocaleString("ko-KR")}</td>
                        <td className="py-2 tabular-nums">{row.label}</td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">문서 유형별 용량</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">유형</th>
                    <th className="py-2 pr-4">건수</th>
                    <th className="py-2">용량</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.by_document_type.map((row) => (
                    <tr key={row.document_type} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-medium text-slate-800">{row.label}</td>
                      <td className="py-2 pr-4 tabular-nums">{row.count.toLocaleString("ko-KR")}</td>
                      <td className="py-2 tabular-nums">{row.bytes_label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download size={16} />
              결과 CSV 다운로드
            </button>
            <button
              type="button"
              onClick={() =>
                downloadJson(`storage-cleanup-candidates-${Date.now()}.json`, {
                  generated_at: full?.generated_at,
                  bucket: full?.bucket,
                  note: "승인 후 CLI storage:cleanup 으로만 삭제",
                  paths: (full?.safe_delete_candidates ?? [])
                    .map((c) => c.storage_path)
                    .filter(Boolean)
                })
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download size={16} />
              삭제 manifest 다운로드
            </button>
            <button
              type="button"
              onClick={() => downloadJson(`storage-audit-full-${Date.now()}.json`, full)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download size={16} />
              전체 JSON
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
