"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderOpen, Loader2, UploadCloud } from "lucide-react";
import {
  EVENT_DOCUMENT_TYPE_LABEL,
  EVENT_FILE_STATUS,
  EVENT_FILE_STATUS_LABEL,
  EVENT_VISIBILITY_LABEL,
  type EventFileStatus
} from "@/lib/events/event-document-types";
import {
  filterCurationRows,
  type EventCurationFilter,
  type EventCurationScanSummary
} from "@/lib/events/event-curation-scan";
import {
  defaultUploadSelected,
  formatEventFileSize,
  rowIsOversized
} from "@/lib/events/event-upload-limits";
import type { EventCurationReviewRow } from "@/types/event";
import { formatDate } from "@/lib/utils";

const STATUS_FILTERS: Array<{ value: EventCurationFilter; label: string }> = [
  { value: "all", label: "전체" },
  ...EVENT_FILE_STATUS.map((status) => ({
    value: status,
    label: EVENT_FILE_STATUS_LABEL[status]
  }))
];

type LiveSummary = EventCurationScanSummary & {
  selected: number;
  unselected: number;
};

function buildLiveSummary(rows: EventCurationReviewRow[]): LiveSummary {
  return {
    totalFiles: rows.length,
    eventFolderCount: new Set(rows.map((row) => row.eventFolderName)).size,
    selected: rows.filter((row) => row.uploadSelected).length,
    unselected: rows.filter((row) => !row.uploadSelected).length,
    representative: rows.filter((row) => row.fileStatus === "representative").length,
    normal: rows.filter((row) => row.fileStatus === "normal").length,
    internal: rows.filter((row) => row.fileStatus === "internal").length,
    draft: rows.filter((row) => row.fileStatus === "draft").length,
    oldVersion: rows.filter((row) => row.fileStatus === "old_version").length,
    duplicate: rows.filter((row) => row.fileStatus === "duplicate").length,
    excluded: rows.filter(
      (row) => row.fileStatus === "excluded" && !rowIsOversized(row)
    ).length,
    oversized: rows.filter((row) => rowIsOversized(row)).length
  };
}

export function EventCurationUploadSection() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileMapRef = useRef<Map<string, File>>(new Map());

  const [rows, setRows] = useState<EventCurationReviewRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<EventCurationFilter>("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    createdEvents: number;
    addedToExistingEvents: number;
    uploadedDocs: number;
    failedUploads: number;
    excludedCount: number;
    skippedDuplicates: number;
    failurePreview?: string;
  } | null>(null);

  const liveSummary = useMemo(() => buildLiveSummary(rows), [rows]);

  const eventOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.eventFolderName))).sort(),
    [rows]
  );

  const typeOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.documentType))).sort(),
    [rows]
  );

  const filteredRows = useMemo(
    () =>
      filterCurationRows(rows, {
        status: statusFilter,
        eventFolder: eventFilter,
        documentType: typeFilter
      }),
    [rows, statusFilter, eventFilter, typeFilter]
  );

  async function handleFolderSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList?.length) return;

    setError(null);
    setResult(null);
    setIsAnalyzing(true);
    fileMapRef.current.clear();

    const files = Array.from(fileList).map((file) => {
      const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
      fileMapRef.current.set(relative, file);

      return {
        originalFilename: file.name,
        sourcePath: relative,
        fileExtension: file.name.split(".").pop()?.toLowerCase() ?? null,
        fileSize: file.size,
        lastModified: file.lastModified
      };
    });

    try {
      const response = await fetch("/api/admin/events/curation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "분석 실패");

      const scannedRows = (data.rows as EventCurationReviewRow[]).map((row) => ({
        ...row,
        rowId: `${row.eventFolderName}::${row.sourcePath}`,
        uploadSelected: row.uploadSelected ?? defaultUploadSelected(row)
      }));
      for (const row of scannedRows) {
        const file = fileMapRef.current.get(row.sourcePath);
        if (file) {
          fileMapRef.current.set(row.rowId, file);
        }
      }
      setRows(scannedRows);
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "분석 실패");
      setRows([]);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function updateRow(rowId: string, patch: Partial<EventCurationReviewRow>) {
    setRows((current) =>
      current.map((row) => {
        if (row.rowId !== rowId) return row;
        const next = { ...row, ...patch };

        if (patch.isRepresentative === true && !rowIsOversized(next)) {
          next.uploadSelected = true;
        }

        if (patch.isRepresentative === false && next.fileStatus === "representative") {
          next.fileStatus = "normal";
        } else if (patch.isRepresentative === true) {
          next.fileStatus = "representative";
        }

        if (patch.uploadSelected === true && rowIsOversized(next)) {
          next.uploadSelected = false;
          window.alert("50MB를 초과하는 파일은 저장할 수 없습니다.");
        }

        return next;
      })
    );
  }

  async function handleCommit() {
    const saveTargets = rows.filter((row) => row.uploadSelected);

    if (saveTargets.length === 0) {
      setError("저장할 파일을 선택해 주세요.");
      return;
    }

    const confirmed = window.confirm(
      `선택된 ${saveTargets.length}개 파일을 저장합니다.\n선택되지 않은 파일은 업로드하지 않습니다.`
    );
    if (!confirmed) return;

    setIsSaving(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("payload", JSON.stringify({ rows: saveTargets }));

      for (const row of saveTargets) {
        const file = fileMapRef.current.get(row.rowId) ?? fileMapRef.current.get(row.sourcePath);
        if (file) {
          formData.append(`file:${row.rowId}`, file);
          formData.append(`file:${row.sourcePath}`, file);
        }
      }

      const response = await fetch("/api/admin/events/curation/commit", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "등록 실패");

      const excludedCount = rows.length - saveTargets.length;
      const failurePreview =
        Array.isArray(data.failures) && data.failures.length > 0
          ? `${data.failures
              .slice(0, 3)
              .map((item: { filename: string }) => item.filename)
              .join(", ")}${data.failures.length > 3 ? " 외" : ""}`
          : undefined;

      setResult({
        createdEvents: data.createdEvents ?? 0,
        addedToExistingEvents: data.addedToExistingEvents ?? 0,
        uploadedDocs: data.uploadedDocs ?? 0,
        failedUploads: data.failedUploads ?? 0,
        excludedCount,
        skippedDuplicates: data.skippedDuplicates ?? 0,
        failurePreview
      });
      router.refresh();
    } catch (commitError) {
      setError(commitError instanceof Error ? commitError.message : "등록 실패");
    } finally {
      setIsSaving(false);
    }
  }

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">행사 폴더 업로드</h2>
        <p className="mt-2 text-sm text-slate-600">
          폴더를 선택하면 파일을 자동 분류합니다. <strong>저장 체크된 파일만</strong> Storage
          (event-documents)에 업로드됩니다. 대표자료는 기본 선택되며, 구버전·중복·용량 초과 파일은
          기본 미선택입니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            {...{ webkitdirectory: "", directory: "" }}
            onChange={handleFolderSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
            행사 폴더 선택
          </button>
          {hasRows ? (
            <button
              type="button"
              onClick={handleCommit}
              disabled={isSaving || liveSummary.selected === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              전체 저장 ({liveSummary.selected}건)
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {result ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">저장이 완료되었습니다.</p>
            <ul className="mt-2 space-y-1 text-sm text-emerald-800">
              <li>생성된 행사: {result.createdEvents}건</li>
              <li>기존 행사에 추가된 파일: {result.addedToExistingEvents}건</li>
              <li>저장 성공: {result.uploadedDocs}건</li>
              <li>저장 실패: {result.failedUploads}건</li>
              <li>제외·미선택: {result.excludedCount}건</li>
              {result.skippedDuplicates > 0 ? (
                <li>중복 스킵: {result.skippedDuplicates}건</li>
              ) : null}
            </ul>
            {result.failurePreview ? (
              <p className="mt-2 text-xs text-red-700">실패 파일: {result.failurePreview}</p>
            ) : null}
            <Link
              href="/dashboard/events"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              행사 현황에서 확인하기
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : null}
      </div>

      {hasRows ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-9">
            <StatCard label="전체 파일" value={liveSummary.totalFiles} />
            <StatCard label="저장 선택" value={liveSummary.selected} tone="blue" />
            <StatCard label="대표자료" value={liveSummary.representative} tone="emerald" />
            <StatCard label="일반자료" value={liveSummary.normal} />
            <StatCard label="구버전" value={liveSummary.oldVersion} tone="slate" />
            <StatCard label="중복" value={liveSummary.duplicate} tone="slate" />
            <StatCard label="제외" value={liveSummary.excluded} tone="slate" />
            <StatCard label="용량 초과" value={liveSummary.oversized} tone="red" />
            <StatCard label="미선택" value={liveSummary.unselected} tone="amber" />
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold",
                  statusFilter === filter.value
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                ].join(" ")}
              >
                {filter.label}
              </button>
            ))}
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
            >
              <option value="all">전체 행사</option>
              {eventOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
            >
              <option value="all">전체 문서유형</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {EVENT_DOCUMENT_TYPE_LABEL[type as keyof typeof EVENT_DOCUMENT_TYPE_LABEL] ?? type}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[1280px] w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-3">저장</th>
                  <th className="px-3 py-3">대표</th>
                  <th className="px-3 py-3">행사명</th>
                  <th className="px-3 py-3">행사일자</th>
                  <th className="px-3 py-3">유형</th>
                  <th className="px-3 py-3">원본 파일명</th>
                  <th className="px-3 py-3">용량</th>
                  <th className="px-3 py-3">문서유형</th>
                  <th className="px-3 py-3">파일 상태</th>
                  <th className="px-3 py-3">분류 사유</th>
                  <th className="px-3 py-3">공개 범위</th>
                  <th className="px-3 py-3">표시 파일명</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const oversized = rowIsOversized(row);
                  return (
                    <tr
                      key={row.rowId}
                      className={row.uploadSelected ? "bg-white hover:bg-slate-50" : "bg-slate-50/60 text-slate-500"}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.uploadSelected}
                          disabled={oversized}
                          title={oversized ? "50MB 초과 파일은 저장할 수 없습니다." : undefined}
                          onChange={(e) =>
                            updateRow(row.rowId, { uploadSelected: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.isRepresentative}
                          disabled={oversized}
                          onChange={(e) =>
                            updateRow(row.rowId, { isRepresentative: e.target.checked })
                          }
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">{row.eventName}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {row.eventDate ? formatDate(row.eventDate) : "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.eventType}</td>
                      <td
                        className="max-w-[14rem] truncate px-3 py-2 text-slate-700"
                        title={row.originalFilename}
                      >
                        {row.originalFilename}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatEventFileSize(row.fileSize)}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {EVENT_DOCUMENT_TYPE_LABEL[row.documentType]}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.fileStatus} oversized={oversized} />
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-slate-500">
                        {row.excludeReason ?? "-"}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={row.visibility}
                          onChange={(e) =>
                            updateRow(row.rowId, {
                              visibility: e.target.value as EventCurationReviewRow["visibility"]
                            })
                          }
                          className="rounded border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="internal_all">{EVENT_VISIBILITY_LABEL.internal_all}</option>
                          <option value="admin_only">{EVENT_VISIBILITY_LABEL.admin_only}</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.displayName}
                          onChange={(e) => updateRow(row.rowId, { displayName: e.target.value })}
                          className="w-full min-w-[10rem] rounded border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "amber" | "violet" | "blue" | "red";
}) {
  const toneClass = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    violet: "text-violet-700",
    blue: "text-blue-700",
    red: "text-red-700"
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({
  status,
  oversized = false
}: {
  status: EventFileStatus;
  oversized?: boolean;
}) {
  if (oversized) {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 ring-1 ring-red-100">
        용량 초과
      </span>
    );
  }

  const tone: Record<EventFileStatus, string> = {
    representative: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    normal: "bg-blue-50 text-blue-800 ring-blue-100",
    internal: "bg-violet-50 text-violet-800 ring-violet-100",
    draft: "bg-amber-50 text-amber-800 ring-amber-100",
    old_version: "bg-slate-100 text-slate-600 ring-slate-200",
    duplicate: "bg-slate-100 text-slate-500 ring-slate-200",
    excluded: "bg-slate-100 text-slate-500 ring-slate-200"
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone[status]}`}>
      {EVENT_FILE_STATUS_LABEL[status]}
    </span>
  );
}
