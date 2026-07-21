"use client";

import { ChevronDown, Copy, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CsvDownloadButton } from "@/components/common/csv-download-button";
import { CopyToast } from "@/components/common/copy-toast";
import {
  buildCopyPayload,
  COPY_EMPTY_MESSAGES,
  COPY_SUCCESS_LABELS,
  type CopyableRow,
  type CopyFormat
} from "@/lib/clipboard/table-copy";
import type { CsvRow } from "@/lib/csv";

type SelectedRowTsvConfig = {
  headers: readonly string[];
  getValues: (row: CopyableRow) => string[];
};

type CopyMenuItem = {
  format: CopyFormat;
  label: string;
};

const COPY_MENU_ITEMS: CopyMenuItem[] = [
  { format: "emails", label: "이메일 복사" },
  { format: "phones", label: "연락처 복사" },
  { format: "name_emails", label: "이름+이메일 복사" },
  { format: "company_name_emails", label: "회사명+이름+이메일 복사" },
  { format: "partner_no_company_name_emails", label: "파트너번호+회사명+이름+이메일 복사" },
  { format: "selected_rows", label: "선택 행 복사" }
];

type TableCopyToolbarProps = {
  allRows: CopyableRow[];
  selectedIds: Set<string>;
  selectedCount: number;
  /** 필터 조건에 맞는 전체 건수 */
  totalCount: number;
  /** 표시 문구 (미지정 시 totalCount 기준 자동 생성) */
  countLabel?: string;
  /** @deprecated 페이지네이션 제거 — countLabel 사용 */
  pageCount?: number;
  onClearSelection: () => void;
  selectedRowTsv: SelectedRowTsvConfig;
  csvRows?: CsvRow[];
  csvFilenamePrefix?: string;
  className?: string;
};

export function TableCopyToolbar({
  allRows,
  selectedIds,
  selectedCount,
  totalCount,
  countLabel: countLabelProp,
  pageCount,
  onClearSelection,
  selectedRowTsv,
  csvRows,
  csvFilenamePrefix,
  className
}: TableCopyToolbarProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const targetRows =
    selectedCount > 0 ? allRows.filter((row) => selectedIds.has(row.id)) : allRows;

  const scopeHint =
    selectedCount > 0
      ? `선택한 ${selectedCount.toLocaleString("ko-KR")}건 기준`
      : `전체 ${totalCount.toLocaleString("ko-KR")}건 기준`;

  const visibleCount = pageCount ?? allRows.length;
  const countLabel =
    countLabelProp ??
    (totalCount > visibleCount
      ? `전체 ${totalCount.toLocaleString("ko-KR")}명 중 ${visibleCount.toLocaleString("ko-KR")}명 표시`
      : `전체 ${totalCount.toLocaleString("ko-KR")}명`);

  const copy = useCallback(
    async (format: CopyFormat) => {
      setMenuOpen(false);
      const payload = buildCopyPayload(format, targetRows, selectedRowTsv);
      if (!payload) {
        setMessageTone("error");
        setMessage(COPY_EMPTY_MESSAGES[format]);
        return;
      }

      try {
        await navigator.clipboard.writeText(payload.text);
        setMessageTone("success");
        setMessage(
          `${COPY_SUCCESS_LABELS[format]} ${payload.count.toLocaleString("ko-KR")}건 복사 완료 · ${scopeHint}`
        );
      } catch {
        setMessageTone("error");
        setMessage("클립보드 복사에 실패했습니다.");
      }
    },
    [targetRows, selectedRowTsv, scopeHint]
  );

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className={className}>
      <CopyToast message={message} tone={messageTone} onDismiss={() => setMessage(null)} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 select-none">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{countLabel}</span>
          {selectedCount > 0 ? (
            <>
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-okestro-700">
                {selectedCount.toLocaleString("ko-KR")}건 선택
              </span>
              <button
                type="button"
                onClick={onClearSelection}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                data-no-drag-scroll
              >
                <X size={12} />
                선택 해제
              </button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-700"
              data-no-drag-scroll
            >
              <Copy size={14} />
              복사
              <ChevronDown size={14} className={menuOpen ? "rotate-180 transition" : "transition"} />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-30 mt-1 min-w-[15rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {COPY_MENU_ITEMS.map((item) => (
                  <button
                    key={item.format}
                    type="button"
                    onClick={() => void copy(item.format)}
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                    data-no-drag-scroll
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {csvRows && csvFilenamePrefix ? (
            <CsvDownloadButton rows={csvRows} filenamePrefix={csvFilenamePrefix} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
