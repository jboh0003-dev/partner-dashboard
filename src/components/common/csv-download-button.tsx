"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { buildCsv, downloadCsv, todayStamp, type CsvRow } from "@/lib/csv";

type CsvDownloadButtonProps = {
  rows: CsvRow[];
  filenamePrefix: string;
  label?: string;
  showCount?: boolean;
  className?: string;
  tone?: "outline" | "primary";
};

export function CsvDownloadButton({
  rows,
  filenamePrefix,
  label = "엑셀 다운로드",
  showCount = true,
  className,
  tone = "outline"
}: CsvDownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  const disabled = rows.length === 0 || busy;

  function handleClick() {
    if (disabled) return;

    setBusy(true);

    try {
      const csv = buildCsv(rows);
      downloadCsv(`${filenamePrefix}-${todayStamp()}`, csv);
    } finally {
      setTimeout(() => setBusy(false), 80);
    }
  }

  const toneCls =
    tone === "primary"
      ? "ui-btn-primary"
      : "ui-btn-secondary";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={[toneCls, className ?? ""].filter(Boolean).join(" ")}
      title="CSV 형식으로 다운로드됩니다. Excel에서 바로 열 수 있습니다."
    >
      <FileSpreadsheet size={16} />
      {label}
      {showCount ? (
        <span className="text-xs font-normal opacity-70">
          ({rows.length.toLocaleString("ko-KR")})
        </span>
      ) : null}
    </button>
  );
}
