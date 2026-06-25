"use client";

import { useMemo, useState } from "react";
import {
  EVENT_DOCUMENT_TYPE_LABEL,
  EVENT_FILE_STATUS,
  EVENT_FILE_STATUS_LABEL,
  EVENT_VISIBILITY_LABEL,
  normalizeEventVisibility,
  type EventFileStatus
} from "@/lib/events/event-document-types";
import type { PartnerEventDocument } from "@/types/event";
import { EventDocumentTableActions } from "@/components/events/event-document-actions";

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EventAllFilesPanel({
  eventId,
  documents,
  disabled = false
}: {
  eventId: string;
  documents: PartnerEventDocument[];
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [extFilter, setExtFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  const typeOptions = useMemo(
    () => Array.from(new Set(documents.map((doc) => doc.document_type).filter(Boolean))).sort(),
    [documents]
  );
  const extOptions = useMemo(
    () => Array.from(new Set(documents.map((doc) => doc.file_extension).filter(Boolean))).sort(),
    [documents]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      if (typeFilter !== "all" && doc.document_type !== typeFilter) return false;
      if (statusFilter !== "all" && doc.file_status !== statusFilter) return false;
      if (extFilter !== "all" && doc.file_extension !== extFilter) return false;
      if (
        visibilityFilter !== "all" &&
        normalizeEventVisibility(doc.visibility) !== visibilityFilter
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        doc.display_name,
        doc.original_file_name,
        doc.source_path,
        doc.document_type
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [documents, query, typeFilter, statusFilter, extFilter, visibilityFilter]);

  return (
    <div className="mt-5 space-y-4">
      <p className="text-xs text-slate-500">
        관리자용 전체 파일 목록입니다. Storage에 저장된 모든 파일 메타데이터를 조회할 수 있습니다.
      </p>

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="파일명 검색"
          className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="all">전체 자료유형</option>
          {typeOptions.map((type) => (
            <option key={type} value={type!}>
              {EVENT_DOCUMENT_TYPE_LABEL[type as keyof typeof EVENT_DOCUMENT_TYPE_LABEL] ?? type}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="all">전체 상태</option>
          {EVENT_FILE_STATUS.map((status) => (
            <option key={status} value={status}>
              {EVENT_FILE_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <select
          value={extFilter}
          onChange={(event) => setExtFilter(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="all">전체 확장자</option>
          {extOptions.map((ext) => (
            <option key={ext} value={ext!}>
              .{ext}
            </option>
          ))}
        </select>
        <select
          value={visibilityFilter}
          onChange={(event) => setVisibilityFilter(event.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
        >
          <option value="all">전체 공개범위</option>
          <option value="internal_all">{EVENT_VISIBILITY_LABEL.internal_all}</option>
          <option value="admin_only">{EVENT_VISIBILITY_LABEL.admin_only}</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[960px] w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">표시명</th>
              <th className="px-3 py-2">원본 파일명</th>
              <th className="px-3 py-2">자료유형</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">확장자</th>
              <th className="px-3 py-2">용량</th>
              <th className="px-3 py-2">공개범위</th>
              <th className="px-3 py-2">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((doc) => (
              <tr key={doc.id} className={disabled ? "opacity-60" : undefined}>
                <td className="px-3 py-2 font-medium text-slate-900">{doc.display_name}</td>
                <td className="px-3 py-2 text-slate-600">{doc.original_file_name ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">
                  {doc.document_type
                    ? EVENT_DOCUMENT_TYPE_LABEL[
                        doc.document_type as keyof typeof EVENT_DOCUMENT_TYPE_LABEL
                      ] ?? doc.document_type
                    : "-"}
                </td>
                <td className="px-3 py-2">
                  {EVENT_FILE_STATUS_LABEL[(doc.file_status ?? "normal") as EventFileStatus] ??
                    doc.file_status}
                </td>
                <td className="px-3 py-2 text-slate-600">{doc.file_extension ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">{formatFileSize(doc.file_size)}</td>
                <td className="px-3 py-2 text-slate-600">
                  {EVENT_VISIBILITY_LABEL[normalizeEventVisibility(doc.visibility)]}
                </td>
                <td className="px-3 py-2">
                  <EventDocumentTableActions doc={doc} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        {filtered.length}건 표시 (전체 {documents.length}건) · 행사 ID {eventId}
      </p>
    </div>
  );
}
