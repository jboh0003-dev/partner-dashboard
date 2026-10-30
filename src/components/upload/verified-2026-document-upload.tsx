"use client";

import { UploadDropArea } from "@/components/upload/upload-drop-area";
import { useMemo, useState } from "react";
import JSZip from "jszip";
import { CheckCircle2, Loader2, UploadCloud, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";

const BATCH_ID = "2026_refresh_20261020";

type BatchEntry = {
  sha256: string;
  partner_id: string;
  partner_name: string;
  document_type: string;
  canonical_name: string;
  source_filename: string;
  received_date: string | null;
  file_size: number;
  status: "pending" | "completed" | "failed";
  document_id: string | null;
  last_error: string | null;
};

type Progress = {
  total: number;
  matched: number;
  uploaded: number;
  reused: number;
  failed: number;
  extra: number;
  current: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  partner_application: "파트너 신청서",
  company_profile: "회사소개서",
  business_registration: "사업자등록증",
  bank_account: "통장사본",
  credit_rating: "신용평가서"
};

function mimeFor(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === "ppt") return "application/vnd.ms-powerpoint";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

async function sha256(buffer: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function markBatch(
  sha: string,
  status: "completed" | "failed",
  documentId?: string | null,
  error?: string | null
) {
  await fetch(`/api/import/partners/documents/verified-batch/${BATCH_ID}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sha256: sha,
      status,
      document_id: documentId ?? null,
      error: error ?? null
    })
  });
}

export function Verified2026DocumentUpload() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errors, setErrors] = useState<Array<{ name: string; message: string }>>([]);
  const [done, setDone] = useState(false);

  const summary = useMemo(() => {
    if (!progress) return null;
    return [
      `검증 대상 ${progress.total}건`,
      `ZIP 매칭 ${progress.matched}건`,
      `신규/교체 ${progress.uploaded}건`,
      `동일 파일 재사용 ${progress.reused}건`,
      `실패 ${progress.failed}건`
    ].join(" · ");
  }, [progress]);

  async function processZip(file: File) {
    setRunning(true);
    setDone(false);
    setErrors([]);

    try {
      const manifestResponse = await fetch(
        `/api/import/partners/documents/verified-batch/${BATCH_ID}`,
        { cache: "no-store" }
      );
      const manifestJson = await manifestResponse.json();
      if (!manifestResponse.ok || !manifestJson.ok) {
        throw new Error(manifestJson?.message ?? "검증 목록을 불러오지 못했습니다.");
      }

      const entries = (manifestJson.entries ?? []) as BatchEntry[];
      const pending = entries.filter((entry) => entry.status !== "completed");
      const byHash = new Map(entries.map((entry) => [entry.sha256, entry]));
      const zip = await JSZip.loadAsync(file);
      const files = Object.values(zip.files).filter(
        (entry) => !entry.dir && !entry.name.startsWith("__MACOSX/")
      );

      const initial: Progress = {
        total: entries.length,
        matched: 0,
        uploaded: 0,
        reused: entries.length - pending.length,
        failed: 0,
        extra: 0,
        current: null
      };
      setProgress(initial);

      const seen = new Set<string>();
      const supabase = createClient();

      for (const zipEntry of files) {
        const buffer = await zipEntry.async("arraybuffer");
        const hash = await sha256(buffer);
        const expected = byHash.get(hash);

        if (!expected) {
          setProgress((prev) =>
            prev ? { ...prev, extra: prev.extra + 1 } : prev
          );
          continue;
        }

        if (seen.has(hash)) continue;
        seen.add(hash);
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                matched: prev.matched + 1,
                current: `${expected.partner_name} · ${TYPE_LABEL[expected.document_type] ?? expected.document_type}`
              }
            : prev
        );

        if (expected.status === "completed") continue;

        try {
          const contentType = mimeFor(expected.canonical_name);
          const metadata = {
            document_type: expected.document_type,
            display_name: expected.canonical_name,
            original_filename: expected.canonical_name,
            file_size: buffer.byteLength,
            file_hash: hash,
            content_type: contentType,
            received_date: expected.received_date,
            note: `2026년 제출자료 최신화 · 원본: ${expected.source_filename}`
          };

          const prepareResponse = await fetch(
            `/api/partners/${expected.partner_id}/documents/direct-upload/prepare`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(metadata)
            }
          );
          const prepared = await prepareResponse.json();
          if (!prepareResponse.ok || !prepared.ok) {
            throw new Error(prepared?.message ?? "업로드 준비 실패");
          }

          if (prepared.reused) {
            await markBatch(hash, "completed", prepared.document_id ?? null);
            setProgress((prev) =>
              prev ? { ...prev, reused: prev.reused + 1 } : prev
            );
            continue;
          }

          const blob = new Blob([buffer], { type: contentType });
          const uploadFile = new File([blob], expected.canonical_name, {
            type: contentType
          });
          const { error: uploadError } = await supabase.storage
            .from(PARTNER_DOCUMENTS_BUCKET)
            .uploadToSignedUrl(prepared.path, prepared.token, uploadFile, {
              contentType
            });
          if (uploadError) throw new Error(uploadError.message);

          const finalizeResponse = await fetch(
            `/api/partners/${expected.partner_id}/documents/direct-upload/finalize`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...metadata,
                storage_path: prepared.path
              })
            }
          );
          const finalized = await finalizeResponse.json();
          if (!finalizeResponse.ok || !finalized.ok) {
            throw new Error(finalized?.message ?? "문서 DB 등록 실패");
          }

          await markBatch(hash, "completed", finalized.document_id ?? null);
          setProgress((prev) =>
            prev ? { ...prev, uploaded: prev.uploaded + 1 } : prev
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "알 수 없는 오류";
          await markBatch(hash, "failed", null, message);
          setErrors((prev) => [
            ...prev,
            { name: expected.canonical_name, message }
          ]);
          setProgress((prev) =>
            prev ? { ...prev, failed: prev.failed + 1 } : prev
          );
        }
      }

      const missing = pending.filter((entry) => !seen.has(entry.sha256));
      if (missing.length > 0) {
        setErrors((prev) => [
          ...prev,
          ...missing.map((entry) => ({
            name: entry.canonical_name,
            message: "현재 ZIP에서 검증된 원본 파일을 찾지 못했습니다."
          }))
        ]);
        setProgress((prev) =>
          prev ? { ...prev, failed: prev.failed + missing.length } : prev
        );
      }

      setProgress((prev) => (prev ? { ...prev, current: null } : prev));
      setDone(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "처리 실패";
      setErrors([{ name: file.name, message }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-base font-bold text-slate-950">
          2026 파트너 문서 검증 반영
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          검증이 끝난 36개 파트너의 174개 문서만 해시로 확인해 등록합니다.
          같은 문서 구분의 기존 문서는 새 파일로 교체되고 다운로드 파일명은 파트너명 기준으로 통일됩니다.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          유아이에스는 현재 Partner Connect의 활성 파트너와 매칭되지 않아 이번 반영에서 제외됩니다.
        </p>

        <UploadDropArea
          accept=".zip"
          disabled={running}
          className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5"
          onError={(message) => setErrors([{ name: "ZIP 파일", message }])}
          onFiles={(files) => { void processZip(files[0]); }}
        >
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          {running ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          {running ? "반영 중..." : "2026년.zip 선택"}
          <input
            type="file"
            accept=".zip,application/zip"
            disabled={running}
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) void processZip(selected);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <p className="mt-2 text-xs text-slate-500">ZIP 파일을 이 영역에 끌어다 놓을 수도 있습니다.</p>
        </UploadDropArea>

        {summary ? (
          <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {summary}
            {progress?.current ? (
              <div className="mt-1 text-xs text-slate-500">처리 중: {progress.current}</div>
            ) : null}
          </div>
        ) : null}

        {done && errors.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            검증 대상 문서 반영이 완료되었습니다.
          </div>
        ) : null}

        {errors.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle size={16} />
              확인 필요 {errors.length}건
            </div>
            <ul className="mt-2 max-h-56 list-disc space-y-1 overflow-auto pl-5 text-xs text-amber-900">
              {errors.map((error, index) => (
                <li key={`${error.name}-${index}`}>
                  {error.name}: {error.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
