"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { optimizePartnerUploadFile, type OptimizedDocument } from "@/lib/documents/optimize-upload-file";
import { readUploadApiJson } from "@/lib/imports/read-upload-api-json";

type Candidate = {
  id: string;
  document_type: string;
  original_filename: string;
  file_size: number;
  extension: string;
  optimizable: boolean;
  has_storage_path: boolean;
};
type Budget = { usedBytes: number; availableBytes: number; limitBytes: number };
type Audit = { ok: boolean; candidates: Candidate[]; budget: Budget; message?: string };
type Result = {
  status: "ready" | "no_gain" | "error" | "done";
  savedBytes: number;
  optimizedBytes: number;
  message?: string;
};
type Progress = {
  action: "analyze" | "replace";
  done: number;
  total: number;
  successes: number;
  failures: number;
  actualSavedBytes: number;
};

const labels: Record<string, string> = {
  company_profile: "회사소개서",
  partner_application: "파트너 신청서",
  partner_contract: "파트너 계약서",
  business_registration: "사업자등록증",
  bank_account: "통장사본",
  credit_rating: "신용평가서",
  security_commitment: "보안확약서"
};

const MiB = 1024 * 1024;
const ANALYSIS_BATCH_SIZE = 60;

function mb(bytes: number) {
  return (bytes / MiB).toFixed(2);
}

async function sha256(file: File): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  return Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("");
}

function contentType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (name.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (name.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function getStatusLabel(value?: Result): string {
  if (!value) return "분석 전";
  switch (value.status) {
    case "ready": return "절감 가능";
    case "no_gain": return "절감 없음";
    case "error": return "확인 필요";
    case "done": return "교체 완료";
  }
}

/**
 * Read-only analysis. Downloaded originals never leave this function's scope;
 * only the estimated byte counts are retained in React state.
 */
async function optimizeCandidate(row: Candidate): Promise<OptimizedDocument> {
  const response = await fetch(
    "/api/partners/documents/" + encodeURIComponent(row.id) + "/download",
    { cache: "no-store" }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(error?.message ?? "원본 다운로드 실패 (HTTP " + response.status + ")");
  }
  const blob = await response.blob();
  if (blob.size !== row.file_size) {
    throw new Error("DB 파일 크기와 다운로드 크기가 다릅니다. 관리자 점검이 필요합니다.");
  }
  const file = new File([blob], row.original_filename, { type: blob.type });
  return optimizePartnerUploadFile(file);
}

async function replaceCandidate(
  row: Candidate,
  optimized: File
): Promise<{ savedBytes: number; removedOriginal: boolean }> {
  const prepare = await readUploadApiJson<{
    ok: boolean;
    path: string;
    token: string;
    message?: string;
  }>(await fetch("/api/admin/storage/optimization", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: row.id,
      file_size: optimized.size
    })
  }));

  const { error: uploadError } = await createClient()
    .storage.from("partner-documents")
    .uploadToSignedUrl(prepare.path, prepare.token, optimized, {
      contentType: contentType(optimized)
    });
  if (uploadError) throw new Error("압축본 업로드 실패: " + uploadError.message);

  const finalized = await readUploadApiJson<{
    ok: boolean;
    saved_bytes: number;
    removed_original: boolean;
    message?: string;
  }>(await fetch("/api/admin/storage/optimization/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document_id: row.id,
      path: prepare.path,
      file_size: optimized.size,
      file_hash: await sha256(optimized)
    })
  }));

  // Reopen the document after its DB pointer moves: actual preview/download
  // availability is part of a successful replacement, not just a 200 response.
  const verification = await fetch(
    "/api/partners/documents/" + encodeURIComponent(row.id) + "/download",
    { cache: "no-store" }
  );
  if (!verification.ok) {
    throw new Error("교체 완료 후 다운로드 검증 실패. 문서 ID " + row.id + "를 확인해 주세요.");
  }
  const downloaded = await verification.blob();
  if (downloaded.size !== optimized.size) {
    throw new Error("교체 완료 후 다운로드 크기 불일치. 문서 ID " + row.id + "를 확인해 주세요.");
  }
  const downloadedHash = await sha256(new File([downloaded], row.original_filename));
  const expectedHash = await sha256(optimized);
  if (downloadedHash !== expectedHash) {
    throw new Error("교체 완료 후 SHA-256 불일치. 문서 ID " + row.id + "를 확인해 주세요.");
  }

  return {
    savedBytes: finalized.saved_bytes,
    removedOriginal: finalized.removed_original
  };
}

function exportCsv(rows: Candidate[], outcomes: Record<string, Result>) {
  const header = ["문서 구분", "파일명", "원본 크기(Byte)", "예상 절감(Byte)", "상태", "비고"];
  function quote(v: string) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  const data = rows.map((row) => {
    const outcome = outcomes[row.id];
    return [
      labels[row.document_type] ?? row.document_type,
      row.original_filename,
      String(row.file_size),
      String(outcome?.savedBytes ?? 0),
      getStatusLabel(outcome),
      outcome?.message ?? ""
    ].map(quote).join(",");
  });
  const csv = "\uFEFF" + [header.map(quote).join(","), ...data].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "PartnerConnect_Storage_Optimization_Report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function StorageOptimizationPanel() {
  const [data, setData] = useState<Audit | null>(null);
  const [type, setType] = useState("priority");
  const [outcomes, setOutcomes] = useState<Record<string, Result>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [totalSaved, setTotalSaved] = useState(0);
  const cancelRequested = useRef(false);
  const running = useRef(false);

  async function reload() {
    const response = await fetch("/api/admin/storage/optimization", { cache: "no-store" });
    const next = await readUploadApiJson<Audit>(response);
    setData(next);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/storage/optimization", { cache: "no-store" })
      .then((r) => readUploadApiJson<Audit>(r))
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const all = data?.candidates ?? [];
    const selected = type === "priority"
      ? all.filter((d) => ["company_profile", "partner_application"].includes(d.document_type))
      : type === "all" ? all : all.filter((d) => d.document_type === type);
    return selected.slice().sort((a, b) => b.file_size - a.file_size);
  }, [data, type]);

  const summary = useMemo(() => {
    const ready = filtered.filter((row) => outcomes[row.id]?.status === "ready");
    return {
      ready,
      readyCount: ready.length,
      pending: filtered.filter((row) => row.optimizable && !outcomes[row.id]).length,
      plannedBytes: ready.reduce((total, row) => total + (outcomes[row.id]?.savedBytes ?? 0), 0),
      examined: filtered.filter((row) => Boolean(outcomes[row.id])).length
    };
  }, [filtered, outcomes]);

  async function analyzeOne(row: Candidate, showNotice = true): Promise<Result> {
    try {
      const result = await optimizeCandidate(row);
      const outcome: Result = result.savedBytes > 0 ? {
        status: "ready",
        savedBytes: result.savedBytes,
        optimizedBytes: result.file.size
      } : {
        status: "no_gain",
        savedBytes: 0,
        optimizedBytes: row.file_size
      };
      setOutcomes((previous) => ({ ...previous, [row.id]: outcome }));
      if (showNotice) setNotice(
        row.original_filename + ": " +
        (outcome.savedBytes > 0
          ? mb(outcome.savedBytes) + " MiB 절감 가능"
          : "안전한 압축으로 줄일 수 있는 용량 없음")
      );
      return outcome;
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "문서 분석 실패";
      const outcome: Result = {
        status: "error", savedBytes: 0, optimizedBytes: 0, message
      };
      setOutcomes((previous) => ({ ...previous, [row.id]: outcome }));
      if (showNotice) setError(message);
      return outcome;
    }
  }

  async function handleSingleAnalyze(row: Candidate) {
    if (running.current) return;
    running.current = true;
    cancelRequested.current = false;
    setBusy(row.id);
    setError(null);
    setNotice(null);
    try {
      await analyzeOne(row);
    } finally {
      setBusy(null);
      running.current = false;
    }
  }

  async function handleBatchAnalyze() {
    if (running.current) return;
    const queue = filtered.filter((row) =>
      row.optimizable && !outcomes[row.id]
    ).slice(0, ANALYSIS_BATCH_SIZE);
    if (!queue.length) {
      setNotice("새로 분석할 문서가 없습니다. 필요한 파일은 개별 분석으로 다시 확인할 수 있습니다.");
      return;
    }

    running.current = true;
    cancelRequested.current = false;
    setError(null);
    setNotice(null);
    let successes = 0;
    let failures = 0;
    let done = 0;
    setProgress({
      action: "analyze", done: 0, total: queue.length,
      successes: 0, failures: 0, actualSavedBytes: 0
    });
    try {
      for (const row of queue) {
        if (cancelRequested.current) break;
        setBusy(row.id);
        const result = await analyzeOne(row, false);
        if (result.status === "ready") successes += 1;
        if (result.status === "error") failures += 1;
        done += 1;
        setProgress({
          action: "analyze", done, total: queue.length,
          successes, failures, actualSavedBytes: 0
        });
      }
      setNotice(
        "분석 " + done + "건 완료 · 절감 가능 " + successes +
        "건 · 확인 필요 " + failures + "건" +
        (cancelRequested.current ? " · 중단됨" : "")
      );
    } finally {
      setBusy(null);
      running.current = false;
    }
  }

  async function replaceOne(row: Candidate, showNotice = true) {
    // Re-download at the time of replacement, rather than retaining hundreds
    // of decrypted private documents in browser memory after an audit.
    const optimized = await optimizeCandidate(row);
    if (!optimized.savedBytes) {
      const outcome: Result = {
        status: "no_gain", savedBytes: 0, optimizedBytes: row.file_size
      };
      setOutcomes((previous) => ({ ...previous, [row.id]: outcome }));
      throw new Error("재검증 시 절감 효과가 없어 교체하지 않았습니다.");
    }
    const saved = await replaceCandidate(row, optimized.file);
    setOutcomes((previous) => ({
      ...previous,
      [row.id]: {
        status: "done",
        savedBytes: saved.removedOriginal ? saved.savedBytes : 0,
        optimizedBytes: optimized.file.size,
        message: saved.removedOriginal
          ? "다운로드·SHA-256 검증 완료"
          : "검증 완료, 원본은 다른 참조로 보존"
      }
    }));
    const actuallySaved = saved.removedOriginal ? saved.savedBytes : 0;
    setTotalSaved((previous) => previous + actuallySaved);
    if (showNotice) setNotice(
      row.original_filename + ": 검증 완료 · 실제 절감 " + mb(actuallySaved) + " MiB"
    );
    return actuallySaved;
  }

  async function handleSingleReplace(row: Candidate) {
    if (running.current || outcomes[row.id]?.status !== "ready") return;
    const yes = window.confirm(
      "압축본을 재검증 후 교체하시겠습니까?\n" +
      "대상: " + row.original_filename + "\n" +
      "예상 절감: " + mb(outcomes[row.id].savedBytes) + " MiB\n\n" +
      "원본을 다른 기록에서 참조하면 작업을 차단합니다.\n" +
      "서버에서 크기·해시·문서 구조를 검증한 뒤 기존 파일을 교체합니다."
    );
    if (!yes) return;

    running.current = true;
    setBusy(row.id);
    setError(null);
    setNotice(null);
    try {
      await replaceOne(row);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "문서 교체 실패");
    } finally {
      setBusy(null);
      running.current = false;
      await reload().catch(() => {});
    }
  }

  async function handleBatchReplace() {
    if (running.current || !summary.ready.length) return;
    // Smaller optimized documents first to reclaim headroom under the soft cap.
    const queue = summary.ready.slice()
      .sort((a, b) => outcomes[a.id].optimizedBytes - outcomes[b.id].optimizedBytes);
    const projected = queue.reduce((n, r) => n + outcomes[r.id].savedBytes, 0);
    const confirmed = window.confirm(
      "기존 문서 " + queue.length + "건을 순차적으로 교체하시겠습니까?\n\n" +
      "예상 총 절감: " + mb(projected) + " MiB (실제 절감은 재검증 후 확정)\n\n" +
      "각 문서는 원본 다운로드 → 재압축 → 새로운 경로 업로드 → " +
      "서버 해시·구조 검증 → DB 변경 → 최종 다운로드 확인 순서로 처리합니다.\n" +
      "다른 문서가 원본을 참조하면 삭제하지 않고 해당 작업을 건너뜁니다.\n" +
      "작업 중 '중단'을 누르면 현재 파일 처리 후 종료됩니다."
    );
    if (!confirmed) return;

    running.current = true;
    cancelRequested.current = false;
    setError(null);
    setNotice(null);
    let done = 0, successes = 0, failures = 0, saved = 0;
    setProgress({
      action: "replace", done: 0, total: queue.length,
      successes: 0, failures: 0, actualSavedBytes: 0
    });
    try {
      for (const row of queue) {
        if (cancelRequested.current) break;
        setBusy(row.id);
        try {
          saved += await replaceOne(row, false);
          successes += 1;
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : "교체 실패";
          failures += 1;
          // Keep the ready status on a temporary upload error, so it may be retried.
          setOutcomes((previous) => ({
            ...previous,
            [row.id]: {
              status: "error",
              savedBytes: previous[row.id]?.savedBytes ?? 0,
              optimizedBytes: previous[row.id]?.optimizedBytes ?? 0,
              message
            }
          }));
        }
        done += 1;
        setProgress({
          action: "replace", done, total: queue.length,
          successes, failures, actualSavedBytes: saved
        });
      }
      setNotice(
        "교체 시도 " + done + "건 · 정상 검증 " + successes +
        "건 · 실패 " + failures + "건 · 실제 절감 " + mb(saved) + " MiB" +
        (cancelRequested.current ? " · 중단됨" : "")
      );
    } finally {
      setBusy(null);
      running.current = false;
      await reload().catch(() => {});
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Storage 사용량</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
            {data ? mb(data.budget.usedBytes) + " MiB" : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">안전 한도까지 여유</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
            {data ? mb(data.budget.availableBytes) + " MiB" : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">이번 화면에서 확인된 실제 절감</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">
            {mb(totalSaved)} MiB
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">기존 문서 용량 최적화</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              관리자 전용 · 분석은 읽기 전용이며 파일을 변경하지 않습니다.
              교체는 확인을 받은 후 파일별 무결성 검증을 통과해야 실행됩니다.
            </p>
          </div>
          <button type="button" disabled={running.current} onClick={() => void reload()}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            용량 새로고침
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="storage-type" className="text-xs font-semibold text-slate-700">문서</label>
          <select id="storage-type" value={type} onChange={(event) => setType(event.target.value)}
            disabled={Boolean(busy)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="priority">회사소개서 / 파트너 신청서</option>
            <option value="company_profile">회사소개서</option>
            <option value="partner_application">파트너 신청서</option>
            <option value="partner_contract">파트너 계약서</option>
            <option value="all">전체 문서</option>
          </select>
          <span className="text-xs text-slate-500">
            총 {filtered.length}건 · 분석 {summary.examined}건 · 미분석 {summary.pending}건
          </span>
          <button type="button" onClick={() => exportCsv(filtered, outcomes)}
            disabled={filtered.length === 0}
            className="ml-auto rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
            분석결과 CSV
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-3">
          <button type="button"
            disabled={Boolean(busy) || summary.pending === 0}
            onClick={() => void handleBatchAnalyze()}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">
            미분석 문서 일괄 분석 (최대 {ANALYSIS_BATCH_SIZE}건)
          </button>
          <button type="button"
            disabled={Boolean(busy) || summary.readyCount === 0}
            onClick={() => void handleBatchReplace()}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-800 disabled:opacity-40">
            절감 가능 {summary.readyCount}건 검증 후 교체
          </button>
          {busy ? (
            <button type="button" onClick={() => { cancelRequested.current = true; }}
              className="rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-xs font-semibold text-rose-700">
              현재 파일 후 중단
            </button>
          ) : null}
          <span className="ml-auto text-xs font-medium tabular-nums text-slate-700">
            예상 절감 {mb(summary.plannedBytes)} MiB
          </span>
        </div>

        {progress ? (
          <div className="mt-3 rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span className="font-semibold">
                {progress.action === "analyze" ? "문서 압축 가능성 분석" : "압축본 교체 및 검증"}
              </span>
              <span className="tabular-nums">
                {progress.done}/{progress.total} · 성공 {progress.successes} · 확인 필요 {progress.failures}
                {progress.action === "replace" ? " · 절감 " + mb(progress.actualSavedBytes) + " MiB" : ""}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: (progress.total ? 100 * progress.done / progress.total : 0) + "%" }} />
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {notice ? <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</p> : null}

        <div className="mt-4 max-h-[620px] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[850px] divide-y divide-slate-100 text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-3 py-3">문서</th>
                <th className="px-3 py-3">파일명</th>
                <th className="px-3 py-3 text-right">원본 용량</th>
                <th className="px-3 py-3 text-right">절감 가능</th>
                <th className="px-3 py-3">상태</th>
                <th className="px-3 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const found = outcomes[row.id];
                return (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                      {labels[row.document_type] ?? row.document_type}
                    </td>
                    <td className="max-w-[350px] truncate px-3 py-3 text-slate-800"
                      title={row.original_filename}>{row.original_filename}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      {mb(row.file_size)} MiB
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      {found?.status === "ready" ? mb(found.savedBytes) + " MiB" : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600"
                      title={found?.message ?? ""}>
                      {row.optimizable ? getStatusLabel(found) : "지원하지 않는 형식"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <button type="button"
                        disabled={!row.optimizable || Boolean(busy)}
                        onClick={() => void handleSingleAnalyze(row)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">
                        {busy === row.id ? "처리 중" : "분석"}
                      </button>
                      <button type="button"
                        disabled={found?.status !== "ready" || Boolean(busy)}
                        onClick={() => void handleSingleReplace(row)}
                        className="ml-2 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30">
                        검증 후 교체
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">선택한 조건에 해당하는 파일이 없습니다.</p>
          ) : null}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          업무 화면에서 선택한 문서 종류를 최대 60건씩 분석합니다. 파일 내용은 분석 과정에서만 메모리에 보관합니다.
          중간에 화면을 닫으면 일괄 작업이 중단되며, 원본은 유지됩니다.
          이미 디지털 서명된 문서와 안전하게 줄일 수 없는 문서는 교체하지 않습니다.
        </p>
      </section>
    </div>
  );
}
