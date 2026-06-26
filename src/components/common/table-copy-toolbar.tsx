"use client";

import { Copy, X } from "lucide-react";
import { useCallback, useState } from "react";
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

type TableCopyToolbarProps = {
  allRows: CopyableRow[];
  selectedIds: Set<string>;
  selectedCount: number;
  filterResultCount: number;
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
  filterResultCount,
  onClearSelection,
  selectedRowTsv,
  csvRows,
  csvFilenamePrefix,
  className
}: TableCopyToolbarProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");

  const targetRows =
    selectedCount > 0
      ? allRows.filter((row) => selectedIds.has(row.id))
      : allRows;

  const scopeHint =
    selectedCount > 0
      ? `선택한 ${selectedCount.toLocaleString("ko-KR")}건 기준`
      : `현재 필터 결과 ${filterResultCount.toLocaleString("ko-KR")}건 기준`;

  const copy = useCallback(
    async (format: CopyFormat) => {
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

  return (
    <div className={className}>
      <CopyToast
        message={message}
        tone={messageTone}
        onDismiss={() => setMessage(null)}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            {scopeHint} · 전체{" "}
            <span className="font-semibold text-slate-700">
              {filterResultCount.toLocaleString("ko-KR")}
            </span>
            건
          </span>
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
              >
                <X size={12} />
                선택 해제
              </button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyActionButton label="이메일 복사" onClick={() => void copy("emails")} />
          <CopyActionButton label="연락처 복사" onClick={() => void copy("phones")} />
          <CopyActionButton
            label="이름+이메일 복사"
            onClick={() => void copy("name_emails")}
          />
          <CopyActionButton
            label="회사명+이름+이메일 복사"
            onClick={() => void copy("company_name_emails")}
          />
          <CopyActionButton
            label="선택 행 복사"
            onClick={() => void copy("selected_rows")}
          />
          {csvRows && csvFilenamePrefix ? (
            <CsvDownloadButton rows={csvRows} filenamePrefix={csvFilenamePrefix} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CopyActionButton({
  label,
  onClick
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-500 hover:text-blue-700"
    >
      <Copy size={14} />
      {label}
    </button>
  );
}
