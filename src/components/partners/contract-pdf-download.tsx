"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export function ContractPdfDownload({ company, ceo, business, grade, start, end }: {
  company: string; ceo?: string | null; business?: string | null; grade: string;
  start?: string | null; end?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setError("");
    if (!ceo || !business || !start) {
      setError("계약서 생성에 필요한 대표자명, 사업자등록번호, 계약 시작일을 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/partner-application/contract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "pdf", company_name_contract: company, ceo_name: ceo,
          business_number: business, grade, contract_start_date: start, contract_end_date: end || undefined })
      });
      if (!response.ok) throw new Error((await response.json()).message || "계약서 생성에 실패했습니다.");
      const filename = response.headers.get("Content-Disposition")?.split("''")[1];
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ? decodeURIComponent(filename) : company + "_계약서.pdf";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "계약서 다운로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return <div>
    <button type="button" onClick={download} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
      <Download size={16} />{busy ? "PDF 생성 중…" : "파트너 계약서 PDF 다운로드"}
    </button>
    {error && <p role="alert" className="mt-1 text-sm text-rose-700">{error}</p>}
  </div>;
}
