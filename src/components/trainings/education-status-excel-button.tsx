"use client";

import { FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { EDUCATION_STATUS_EMPTY_MESSAGE } from "@/lib/trainings/education-status-export";

type EducationStatusExcelButtonProps = {
  q?: string;
  month?: string;
  training?: string;
};

export function EducationStatusExcelButton({
  q = "",
  month = "all",
  training = "all"
}: EducationStatusExcelButtonProps) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      params.set("month", month || "all");
      if (training && training !== "all") params.set("training", training);

      const response = await fetch(`/api/trainings/education-status/export?${params.toString()}`);
      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok || contentType.includes("application/json")) {
        const json = (await response.json().catch(() => null)) as { message?: string } | null;
        window.alert(json?.message ?? EDUCATION_STATUS_EMPTY_MESSAGE);
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
      const filename = filenameMatch?.[1]
        ? decodeURIComponent(filenameMatch[1])
        : filenameMatch?.[2] ?? "education_status.xlsx";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      window.alert("Excel 다운로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-okestro-200 hover:bg-okestro-50/40 disabled:opacity-60"
    >
      <FileSpreadsheet size={16} />
      {busy ? "다운로드 중..." : "Excel 다운로드"}
    </button>
  );
}
