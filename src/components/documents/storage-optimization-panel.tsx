"use client";

import { useEffect, useMemo, useState } from "react";
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
type Analysis = { original: File; result: OptimizedDocument };
const labels: Record<string, string> = {
  company_profile: "회사소개서",
  partner_application: "파트너 신청서",
  partner_contract: "파트너 계약서",
  business_registration: "사업자등록증",
  bank_account: "통장사본",
  credit_rating: "신용평가서"
};
function mb(bytes: number) { return (bytes / 1024 / 1024).toFixed(2); }
async function digest(file: File) {
  const result = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  return Array.from(result).map((n) => n.toString(16).padStart(2, "0")).join("");
}
function contentType(file: File) {
  if (file.type) return file.type;
  if (/\.pdf$/i.test(file.name)) return "application/pdf";
  if (/\.pptx$/i.test(file.name)) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (/\.docx$/i.test(file.name)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

export function StorageOptimizationPanel() {
  const [data, setData] = useState<Audit | null>(null);
  const [type, setType] = useState("priority");
  const [results, setResults] = useState<Record<string, Analysis>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [totalSaved, setTotalSaved] = useState(0);

  async function reload() {
    const res = await fetch("/api/admin/storage/optimization", { cache: "no-store" });
    const body = await readUploadApiJson<Audit>(res);
    setData(body);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/admin/storage/optimization", { cache: "no-store" })
      .then((r) => readUploadApiJson<Audit>(r))
      .then((d) => { if (active) setData(d); })
      .catch((e) => { if (active) setError(String(e instanceof Error ? e.message : e)); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const rows = data?.candidates ?? [];
    const list = type === "priority"
      ? rows.filter((d) => ["company_profile", "partner_application"].includes(d.document_type))
      : type === "all" ? rows : rows.filter((d) => d.document_type === type);
    return [...list].sort((a, b) => b.file_size - a.file_size);
  }, [data, type]);

  async function analyze(row: Candidate) {
    setBusy(row.id);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/partners/documents/" + encodeURIComponent(row.id) + "/download", {
        cache: "no-store"
      });
      if (!response.ok) {
        const msg = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(msg?.message ?? "원본 문서를 다운로드할 수 없습니다. HTTP " + response.status);
      }
      const blob = await response.blob();
      const file = new File([blob], row.original_filename, { type: blob.type });
      if (blob.size !== row.file_size) {
        throw new Error("DB에 기록된 원본 크기와 다운로드 크기가 다릅니다. 변경하지 않았습니다.");
      }
      const result = await optimizePartnerUploadFile(file);
      setResults((current) => ({ ...current, [row.id]: { original: file, result } }));
      setNotice(result.savedBytes > 0
        ? row.original_filename + ": " + mb(result.savedBytes) + "MiB 절감 가능"
        : row.original_filename + ": 안전하게 줄일 수 있는 용량이 없습니다. 원본 유지");
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 실패");
    } finally {
      setBusy(null);
    }
  }

  async function replace(row: Candidate) {
    const candidate = results[row.id];
    if (!candidate?.result.savedBytes) return;
    const yes = window.confirm(
      "해당 문서를 압축본으로 교체하시겠습니까?\n\n" +
      "원본을 그대로 유지한 채 새 파일 업로드 → 재다운로드·SHA-256 검증 → DB 경로 교체 순서로 실행합니다.\n" +
      "기존 원본은 다른 문서에서 참조하지 않는 것으로 확인된 경우에만 마지막에 삭제합니다.\n" +
      "문서: " + row.original_filename + "\n" +
      "예상 절감: " + mb(candidate.result.savedBytes) + " MiB"
    );
    if (!yes) return;
    setBusy(row.id);
    setError(null);
    setNotice(null);
    try {
      const optimized = candidate.result.file;
      const prepare = await readUploadApiJson<{ ok: boolean; path: string; token: string; message?: string }>(
        await fetch("/api/admin/storage/optimization", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: row.id, file_size: optimized.size })
        })
      );
      const { error: uploadError } = await createClient().storage.from("partner-documents")
        .uploadToSignedUrl(prepare.path, prepare.token, optimized, {
          contentType: contentType(optimized)
        });
      if (uploadError) throw new Error(uploadError.message);
      const saved = await readUploadApiJson<{
        ok: boolean;
        saved_bytes: number;
        removed_original: boolean;
        budget: Budget;
        message?: string;
      }>(await fetch("/api/admin/storage/optimization/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: row.id, path: prepare.path,
          file_size: optimized.size, file_hash: await digest(optimized)
        })
      }));
      setTotalSaved((current) => current + (saved.removed_original ? saved.saved_bytes : 0));
      setResults((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      setNotice("압축본 교체 및 다운로드 검증 완료 · " +
        (saved.removed_original
          ? "실제 절감 " + mb(saved.saved_bytes) + "MiB"
          : "기존 파일을 참조하는 기록이 있어 원본은 보존됨"));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "교체 실패");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">전체 Storage 사용량</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
            {data ? mb(data.budget.usedBytes) + " MiB" : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">업로드 안전 한도까지 여유</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
            {data ? mb(data.budget.availableBytes) + " MiB" : "-"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">이번 화면에서 원본 제거까지 확인된 절감</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">
            {mb(totalSaved)} MiB
          </p>
        </div>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900">기존 문서 용량 최적화</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          파일별 <strong>분석</strong>은 다운로드 및 압축 가능성 확인만 수행하며, Storage를 변경하지 않습니다.
          <strong> 검증 후 교체</strong>를 클릭하고 확인해야 기존 문서가 변경됩니다.
          서명된 PDF, 손상 문서, 절감 효과가 없는 Excel·PPT 파일은 원본 그대로 보존합니다.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          원본 파일을 추가 저장하지 않고 브라우저에서 압축하며, 검증된 새 파일만 Supabase에 업로드합니다.
          여러 문서를 동시에 처리하지 않아 저장 여유를 보호합니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="storage-type" className="text-xs font-semibold text-slate-700">문서 구분</label>
          <select id="storage-type" className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={type} onChange={(ev) => setType(ev.target.value)}>
            <option value="priority">우선 대상 (회사소개서 / 신청서)</option>
            <option value="company_profile">회사소개서</option>
            <option value="partner_application">파트너 신청서</option>
            <option value="partner_contract">파트너 계약서</option>
            <option value="all">전체</option>
          </select>
          <span className="text-xs text-slate-500">{filtered.length}건 · 큰 파일 순</span>
          <button type="button" disabled={Boolean(busy)} onClick={() => void reload()}
            className="ml-auto rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
            용량 새로고침
          </button>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
        {notice ? <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{notice}</p> : null}
        <div className="mt-4 max-h-[620px] overflow-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[780px] divide-y divide-slate-100 text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600">
              <tr>
                <th className="px-3 py-3">문서 구분</th>
                <th className="px-3 py-3">파일명</th>
                <th className="px-3 py-3 text-right">원본 용량</th>
                <th className="px-3 py-3 text-right">절감 가능</th>
                <th className="px-3 py-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => {
                const found = results[row.id];
                return (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                      {labels[row.document_type] ?? row.document_type}
                    </td>
                    <td className="max-w-[360px] truncate px-3 py-3 text-slate-800"
                      title={row.original_filename}>{row.original_filename}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      {mb(row.file_size)} MiB
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                      {found ? mb(found.result.savedBytes) + " MiB" : "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <button type="button"
                        disabled={!row.optimizable || Boolean(busy)}
                        onClick={() => void analyze(row)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">
                        {busy === row.id ? "처리 중" : "분석"}
                      </button>
                      <button type="button"
                        disabled={!found?.result.savedBytes || Boolean(busy)}
                        onClick={() => void replace(row)}
                        className="ml-2 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-30">
                        검증 후 교체
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
