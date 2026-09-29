"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, FileSpreadsheet, RotateCcw, Search } from "lucide-react";
import type { ContractStatusExportRow } from "@/lib/partners/contract-status-export";

type Props = {
  headers: readonly string[];
  rows: ContractStatusExportRow[];
};

const CORE_END = 31;

function clipboardText(values: string[]): string {
  return values
    .map((value) =>
      String(value ?? "")
        .replace(/\t/g, " ")
        .replace(/\r?\n/g, " ")
        .trim()
    )
    .join("\t");
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function ContractStatusExportPanel({ headers, rows }: Props) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(rows[0]?.partnerId ?? null);
  const [activeDetail, setActiveDetail] = useState<ContractStatusExportRow | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.externalNo, row.companyName, row.contractDate, row.grade]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query, rows]);

  const active = useMemo(
    () => rows.find((row) => row.partnerId === activeId) ?? null,
    [activeId, rows]
  );

  useEffect(() => {
    if (!activeId) {
      setActiveDetail(null);
      setDraft([]);
      return;
    }

    const controller = new AbortController();
    setDetailLoading(true);
    setDetailError(null);
    setActiveDetail(null);
    setDraft([]);

    fetch(`/api/admin/contract-export/${activeId}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.ok || !json?.row) {
          throw new Error(json?.message ?? "계약현황 데이터를 불러오지 못했습니다.");
        }
        return json.row as ContractStatusExportRow;
      })
      .then((row) => {
        setActiveDetail(row);
        setDraft([...row.values]);
        setCopied(null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDetailError(error instanceof Error ? error.message : "계약현황 데이터를 불러오지 못했습니다.");
      })
      .finally(() => setDetailLoading(false));

    return () => controller.abort();
  }, [activeId]);

  useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((row) => row.partnerId === activeId)) {
      setActiveId(filtered[0].partnerId);
    }
  }, [activeId, filtered]);

  async function handleCopy(includeHeader = false) {
    if (!activeDetail) return;
    const body = clipboardText(draft);
    const text = includeHeader
      ? `${clipboardText([...headers])}\n${body}`
      : body;
    await copyText(text);
    setCopied(includeHeader ? "헤더 + 1행 복사 완료" : "엑셀 1행 복사 완료");
    window.setTimeout(() => setCopied(null), 2200);
  }

  function updateCell(index: number, value: string) {
    setDraft((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  function resetDraft() {
    if (!activeDetail) return;
    setDraft([...activeDetail.values]);
  }

  const missingCore = draft
    .slice(0, CORE_END)
    .filter((value) => !String(value ?? "").trim()).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="ui-card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="회사명 / No / 계약일 / 등급 검색"
              className="ui-input w-full pl-9"
            />
          </div>
          <div className="mt-3 text-xs text-slate-500">
            {filtered.length.toLocaleString("ko-KR")}개 파트너
          </div>
        </div>

        <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
          {filtered.map((row) => {
            const selected = row.partnerId === activeId;
            return (
              <button
                key={row.partnerId}
                type="button"
                onClick={() => setActiveId(row.partnerId)}
                className={[
                  "w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0",
                  selected ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {row.companyName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      No {row.externalNo || "-"} · {row.contractDate || "계약일 미입력"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                    {row.grade || "미분류"}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">검색 결과가 없습니다.</div>
          ) : null}
        </div>
      </section>

      <section className="ui-card min-w-0 p-5">
        {active ? (
          detailLoading ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">
              계약현황 데이터를 불러오는 중…
            </div>
          ) : detailError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {detailError}
            </div>
          ) : activeDetail ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={20} className="text-blue-600" />
                  <h2 className="text-lg font-semibold text-slate-950">{activeDetail.companyName}</h2>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  1.파트너계약현황 A:AQ 순서 그대로 생성됩니다. 아래 값은 복사 전에 임시 수정할 수 있습니다.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  기본 31개 항목 중 빈칸 {missingCore}개 · 수정 내용은 Connect DB에 저장되지 않습니다.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={resetDraft} className="ui-btn-secondary">
                  <RotateCcw size={15} />
                  원본값 복원
                </button>
                <button type="button" onClick={() => handleCopy(true)} className="ui-btn-secondary">
                  헤더 포함 복사
                </button>
                <button type="button" onClick={() => handleCopy(false)} className="ui-btn-accent">
                  <ClipboardCopy size={15} />
                  엑셀 1행 복사
                </button>
              </div>
            </div>

            {copied ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                <Check size={16} />
                {copied}
              </div>
            ) : null}

            <div className="mt-5 space-y-6">
              <FieldSection
                title="계약 기본정보"
                headers={headers}
                values={draft}
                start={0}
                end={18}
                onChange={updateCell}
              />
              <FieldSection
                title="회사·계약 관리 정보"
                headers={headers}
                values={draft}
                start={18}
                end={31}
                onChange={updateCell}
              />
              <FieldSection
                title="교육·행사 이력"
                headers={headers}
                values={draft}
                start={31}
                end={headers.length}
                onChange={updateCell}
              />
            </div>

            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-slate-700">
              <strong className="text-blue-800">사용법:</strong> 원하는 파트너 선택 → 필요한 빈칸만 보완 →
              <strong> 엑셀 1행 복사</strong> → 로컬 파일의 해당 행 A열에서 Ctrl+V.
              빈 값도 탭 칸으로 유지되어 열이 밀리지 않습니다.
            </div>
          </>
          ) : null
        ) : (
          <div className="py-20 text-center text-sm text-slate-500">파트너를 선택해주세요.</div>
        )}
      </section>
    </div>
  );
}

function FieldSection({
  title,
  headers,
  values,
  start,
  end,
  onChange
}: {
  title: string;
  headers: readonly string[];
  values: string[];
  start: number;
  end: number;
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {headers.slice(start, end).map((header, offset) => {
          const index = start + offset;
          return (
            <label key={`${header}-${index}`} className="min-w-0">
              <span className="mb-1 block whitespace-pre-line text-[11px] font-medium text-slate-500">
                {String(index + 1).padStart(2, "0")}. {header}
              </span>
              <input
                value={values[index] ?? ""}
                onChange={(event) => onChange(index, event.target.value)}
                className="ui-input w-full"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
