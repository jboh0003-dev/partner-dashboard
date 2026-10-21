"use client";

import { useMemo, useState } from "react";
import JSZip from "jszip";
import { AlertTriangle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { parsePartnerDocumentFile } from "@/lib/documents/parse-metadata";
import { createClient } from "@/lib/supabase/client";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";

type MatchItem = ReturnType<typeof parsePartnerDocumentFile> & {
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  match_status: "matched" | "needs_review" | "unmatched";
  match_method: string | null;
  match_confidence: number;
  document_type: string;
  reason: string;
  action?: "create" | "update" | "skip" | "review";
  review_status?: string;
};

type Candidate = {
  key: string;
  zipName: string;
  zipRank: number;
  path: string;
  file: File;
  row: ReturnType<typeof parsePartnerDocumentFile>;
  match?: MatchItem;
};

type Result = {
  totalFiles: number;
  considered: number;
  selected: number;
  uploaded: number;
  reused: number;
  duplicateSkipped: number;
  skipped: number;
  unregisteredExcluded: number;
  failed: number;
  unmatched: Array<{ path: string; reason: string }>;
  failures: Array<{ path: string; reason: string }>;
};

const ALLOWED_TYPES = new Set([
  "partner_application",
  "company_profile",
  "business_registration",
  "bank_account",
  "credit_rating"
]);

const TYPE_LABEL: Record<string,string> = {
  partner_application: "오케스트로 파트너 신청서",
  company_profile: "회사소개서",
  business_registration: "사업자등록증",
  bank_account: "통장사본",
  credit_rating: "신용평가서"
};

const SUPPORTED_EXT = new Set([
  "pdf","xlsx","xls","ppt","pptx","doc","docx","png","jpg","jpeg"
]);

function batchRank(zipName: string): number {
  const n = zipName.replace(/\s+/g, "");
  if (/2026/.test(n)) return 400;
  if (/12월/.test(n)) return 330;
  if (/11월/.test(n)) return 320;
  if (/4분기/.test(n)) return 310;
  if (/3분기/.test(n)) return 300;
  if (/2분기/.test(n)) return 200;
  if (/1분기/.test(n)) return 100;
  return 0;
}

function basename(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function extension(name: string) {
  return (name.split(".").pop() ?? "").toLowerCase();
}

function canonicalFilename(partnerName: string, documentType: string, sourceName: string) {
  const ext = extension(sourceName);
  const label = TYPE_LABEL[documentType] ?? documentType;
  return `${partnerName}_${label}.${ext}`;
}

function contentTypeFor(name: string) {
  const ext = extension(name);
  const map: Record<string,string> = {
    pdf:"application/pdf",
    xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls:"application/vnd.ms-excel",
    ppt:"application/vnd.ms-powerpoint",
    pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",
    doc:"application/msword",
    docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    png:"image/png",
    jpg:"image/jpeg",
    jpeg:"image/jpeg"
  };
  return map[ext] ?? "application/octet-stream";
}

async function sha256(file: File) {
  const data = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((v) => v.toString(16).padStart(2,"0"))
    .join("");
}

function candidateScore(candidate: Candidate) {
  const r = candidate.row;
  const year = r.period_year ?? 0;
  const quarter = Number(r.period_quarter?.match(/\d/)?.[0] ?? 0);
  const month = r.period_month ?? 0;

  // ZIP 파일명이 바뀌거나 여러 묶음이 합쳐져도 내부 경로의 연/분기/월을 우선한다.
  let score = year * 1_000_000_000 + quarter * 10_000_000 + month * 100_000;
  if (!year) score += candidate.zipRank * 1_000_000;

  if (r.received_date) {
    const t = Date.parse(r.received_date);
    if (Number.isFinite(t)) score += Math.floor(t / 86_400_000);
  }

  const m = candidate.path.match(/(?:20)?(\d{2})[.\-_ ]?(\d{2})[.\-_ ]?(\d{2})/);
  if (m) {
    const fileYear = Number(m[1]) < 70 ? 2000 + Number(m[1]) : 1900 + Number(m[1]);
    const t = Date.UTC(fileYear, Number(m[2]) - 1, Number(m[3]));
    if (Number.isFinite(t)) score += Math.floor(t / 86_400_000);
  }
  return score;
}

async function matchRows(rows: ReturnType<typeof parsePartnerDocumentFile>[]) {
  const response = await fetch("/api/import/partners/documents/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows })
  });
  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(json?.message ?? "파트너 매칭 실패");
  }
  return (json.items ?? []) as MatchItem[];
}

export function HistoricalPartnerDocumentsUpload() {
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const summary = useMemo(() => {
    if (!result) return null;
    return `원본 ${result.totalFiles}건 · 대상 ${result.considered}건 · 반영대상 ${result.selected}건 · 신규반영 ${result.uploaded}건 · 기존동일 ${result.reused}건 · 원본중복/기등록 ${result.duplicateSkipped}건 · 미등록 파트너 제외 ${result.unregisteredExcluded}건 · 확인필요 ${result.unmatched.length}건 · 실패 ${result.failed}건`;
  }, [result]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length || running) return;
    setRunning(true);
    setResult(null);

    const out: Result = {
      totalFiles: 0,
      considered: 0,
      selected: 0,
      uploaded: 0,
      reused: 0,
      duplicateSkipped: 0,
      skipped: 0,
      unregisteredExcluded: 0,
      failed: 0,
      unmatched: [],
      failures: []
    };

    try {
      setStage("ZIP 파일을 해제하고 문서 정보를 읽는 중...");
      const zips = Array.from(fileList);
      const candidates: Candidate[] = [];
      let rowNumber = 1;

      for (const zipFile of zips) {
        const zip = await JSZip.loadAsync(zipFile);
        const rank = batchRank(zipFile.name);

        for (const entry of Object.values(zip.files)) {
          if (entry.dir || entry.name.startsWith("__MACOSX/")) continue;
          out.totalFiles += 1;

          const name = basename(entry.name);
          const ext = extension(name);
          if (!SUPPORTED_EXT.has(ext) || name.startsWith(".")) {
            out.skipped += 1;
            continue;
          }

          const blob = await entry.async("blob");
          if (blob.size <= 0) {
            out.skipped += 1;
            continue;
          }
          const file = new File([blob], name, { type: contentTypeFor(name) });
          Object.defineProperty(file, "webkitRelativePath", {
            value: `${zipFile.name.replace(/\.zip$/i,"")}/${entry.name}`,
            configurable: true
          });

          const row = parsePartnerDocumentFile(file, rowNumber++);
          if (!ALLOWED_TYPES.has(row.document_type)) {
            out.skipped += 1;
            continue;
          }

          candidates.push({
            key: `${zipFile.name}::${entry.name}`,
            zipName: zipFile.name,
            zipRank: rank,
            path: entry.name,
            file,
            row
          });
        }
      }

      out.considered = candidates.length;
      setStage(`파트너와 문서 종류를 대조하는 중... (${candidates.length}건)`);

      const chunkSize = 120;
      for (let i = 0; i < candidates.length; i += chunkSize) {
        const slice = candidates.slice(i, i + chunkSize);
        const matched = await matchRows(slice.map((c) => c.row));
        for (let j = 0; j < slice.length; j++) {
          slice[j]!.match = matched[j];
        }
      }

      const good: Candidate[] = [];
      for (const c of candidates) {
        const m = c.match;

        if (m?.action === "skip" || m?.review_status === "skipped") {
          if (/동일\s*파일|중복\s*파일|업로드\s*배치\s*내\s*중복/i.test(m.reason ?? "")) {
            out.duplicateSkipped += 1;
          } else {
            out.skipped += 1;
          }
          continue;
        }

        if (!m?.matched_partner_id || !m.matched_partner_name || m.match_status !== "matched") {
          if (m?.match_status === "unmatched" && m.reason.includes("파트너 DB에 등록되지 않은 회사")) {
            out.unregisteredExcluded += 1;
            continue;
          }
          out.unmatched.push({
            path: `${c.zipName} / ${c.path}`,
            reason: m?.reason || "파트너 자동 매칭 확인 필요"
          });
          continue;
        }
        good.push(c);
      }

      const newest = new Map<string,Candidate>();
      for (const c of good) {
        const m = c.match!;
        const group = `${m.matched_partner_id}::${m.document_type}`;
        const previous = newest.get(group);
        if (!previous || candidateScore(c) > candidateScore(previous)) {
          newest.set(group, c);
        }
      }

      const selected = Array.from(newest.values()).sort((a,b) => candidateScore(a) - candidateScore(b));
      out.selected = selected.length;

      const supabase = createClient();

      for (let i = 0; i < selected.length; i++) {
        const c = selected[i]!;
        const m = c.match!;
        const canonical = canonicalFilename(
          m.matched_partner_name!,
          m.document_type,
          c.file.name
        );

        setStage(`Connect 반영 중 ${i + 1}/${selected.length} · ${m.matched_partner_name} · ${TYPE_LABEL[m.document_type] ?? m.document_type}`);

        try {
          const hash = await sha256(c.file);
          const metadata = {
            document_type: m.document_type,
            display_name: TYPE_LABEL[m.document_type] ?? m.document_type,
            original_filename: canonical,
            file_size: c.file.size,
            file_hash: hash,
            content_type: contentTypeFor(canonical),
            received_date: c.row.received_date,
            note: `과거 파트너 제출자료 최신화 · 원본: ${c.zipName} / ${c.path}`
          };

          const prepareResponse = await fetch(
            `/api/partners/${m.matched_partner_id}/documents/direct-upload/prepare`,
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
            out.reused += 1;
            continue;
          }

          const uploadFile = new File([await c.file.arrayBuffer()], canonical, {
            type: contentTypeFor(canonical)
          });
          const { error: uploadError } = await supabase.storage
            .from(PARTNER_DOCUMENTS_BUCKET)
            .uploadToSignedUrl(prepared.path, prepared.token, uploadFile, {
              contentType: contentTypeFor(canonical)
            });
          if (uploadError) throw new Error(uploadError.message);

          const finalizeResponse = await fetch(
            `/api/partners/${m.matched_partner_id}/documents/direct-upload/finalize`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...metadata, storage_path: prepared.path })
            }
          );
          const finalized = await finalizeResponse.json();
          if (!finalizeResponse.ok || !finalized.ok) {
            throw new Error(finalized?.message ?? "문서 등록 실패");
          }

          out.uploaded += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : "알 수 없는 오류";
          if (/동일\s*파일.*이미\s*등록|already\s*(exists|registered)|asset\s*already\s*exists/i.test(message)) {
            out.reused += 1;
            continue;
          }
          out.failed += 1;
          out.failures.push({
            path: `${c.zipName} / ${c.path}`,
            reason: message
          });
        }
      }

      setResult({ ...out });
      setStage(null);
    } catch (error) {
      out.failed += 1;
      out.failures.push({
        path: "전체 작업",
        reason: error instanceof Error ? error.message : "처리 실패"
      });
      setResult({ ...out });
      setStage(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">과거 파트너 문서 일괄 최신화</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          ZIP 여러 개를 한 번에 선택하면 파트너·문서종류를 자동 대조하고,
          파트너별 문서 종류마다 반영할 자료 1건을 Partner Connect에 연결합니다.
          이미 등록된 동일·중복 파일은 다시 등록하지 않으며, 다운로드 파일명은 파트너명 기준으로 통일합니다.
        </p>

        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          {running ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          {running ? "처리 중..." : "ZIP 여러 개 선택"}
          <input
            type="file"
            accept=".zip,application/zip"
            multiple
            disabled={running}
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>

        {stage ? (
          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{stage}</div>
        ) : null}

        {summary ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
            {summary}
          </div>
        ) : null}

        {result && result.failed === 0 && result.unmatched.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={16} />
            전체 반영 및 최신본 정리가 완료되었습니다.
          </div>
        ) : null}

        {result && (result.unmatched.length > 0 || result.failures.length > 0) ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <AlertTriangle size={16} />
              확인 필요 {result.unmatched.length + result.failures.length}건
            </div>
            <ul className="mt-2 max-h-72 list-disc space-y-1 overflow-auto pl-5 text-xs text-amber-900">
              {result.unmatched.map((x) => <li key={`u-${x.path}`}>{x.path}: {x.reason}</li>)}
              {result.failures.map((x) => <li key={`f-${x.path}`}>{x.path}: {x.reason}</li>)}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}