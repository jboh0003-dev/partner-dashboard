"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";

type ImportJobView = {
  id: string;
  import_type: string;
  file_name: string;
  status: string;
  total_rows: number | null;
  processed_rows: number | null;
  created_count: number | null;
  updated_count: number | null;
  skipped_count: number | null;
  review_count: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
  started_at: string | null;
  is_stale?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  processing: "저장 중",
  completed: "완료",
  completed_with_review: "완료(검토)",
  failed: "실패",
  cancelled: "취소됨"
};

type Props = {
  importType?: string;
  /** 저장 중이면 더 자주 폴링 */
  pollFast?: boolean;
};

export function ImportJobsPanel({
  importType = "contact_full_db_upload",
  pollFast = false
}: Props) {
  const [jobs, setJobs] = useState<ImportJobView[]>([]);
  const [activeJobs, setActiveJobs] = useState<ImportJobView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/import/jobs?import_type=${encodeURIComponent(importType)}`
      );
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "작업 상태 조회 실패");
      }
      setJobs(json.jobs as ImportJobView[]);
      setActiveJobs(json.active_jobs as ImportJobView[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "작업 상태 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [importType]);

  useEffect(() => {
    void load();
    const intervalMs = pollFast || activeJobs.length > 0 ? 2500 : 12000;
    const timer = window.setInterval(() => {
      void load();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [load, pollFast, activeJobs.length]);

  async function handleCancel(jobId: string) {
    setCancellingId(jobId);
    try {
      const response = await fetch(`/api/import/jobs/${jobId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "취소 실패");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "취소 실패");
    } finally {
      setCancellingId(null);
    }
  }

  if (loading && jobs.length === 0) {
    return (
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={14} className="animate-spin" />
          전체DB import 작업 상태 확인 중…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
        <div className="text-sm text-rose-700">{error}</div>
      </section>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-slate-900">전체DB import 작업</div>

      {activeJobs.length > 0 ? (
        <div className="mb-3 space-y-2">
          {activeJobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2"
            >
              <div className="min-w-0 text-xs text-blue-950">
                <div className="font-semibold">
                  {STATUS_LABEL[job.status] ?? job.status}
                  {job.is_stale ? " · stale" : ""}
                </div>
                <div className="mt-0.5 truncate">{job.file_name}</div>
                <div className="mt-0.5 text-blue-800">
                  시작 {formatTime(job.started_at ?? job.created_at)} · 처리{" "}
                  {(job.processed_rows ?? 0).toLocaleString("ko-KR")} /{" "}
                  {(job.total_rows ?? 0).toLocaleString("ko-KR")}행
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleCancel(job.id)}
                disabled={cancellingId === job.id}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                {cancellingId === job.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <XCircle size={12} />
                )}
                작업 취소
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mb-2 text-xs text-slate-500">현재 실행 중인 전체DB import가 없습니다.</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="px-2 py-1 font-medium">상태</th>
              <th className="px-2 py-1 font-medium">파일</th>
              <th className="px-2 py-1 font-medium">진행</th>
              <th className="px-2 py-1 font-medium">결과</th>
              <th className="px-2 py-1 font-medium">시각</th>
            </tr>
          </thead>
          <tbody>
            {jobs.slice(0, 8).map((job) => (
              <tr key={job.id} className="border-t border-slate-100 text-slate-700">
                <td className="px-2 py-1.5">{STATUS_LABEL[job.status] ?? job.status}</td>
                <td className="max-w-[14rem] truncate px-2 py-1.5" title={job.file_name}>
                  {job.file_name}
                </td>
                <td className="px-2 py-1.5 tabular-nums">
                  {(job.processed_rows ?? 0).toLocaleString("ko-KR")}/
                  {(job.total_rows ?? 0).toLocaleString("ko-KR")}
                </td>
                <td className="px-2 py-1.5 tabular-nums">
                  +{job.created_count ?? 0} / ~{job.updated_count ?? 0} / 검토{" "}
                  {job.review_count ?? 0}
                </td>
                <td className="px-2 py-1.5">{formatTime(job.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}
