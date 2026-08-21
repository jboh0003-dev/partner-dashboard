"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { CopyToast } from "@/components/common/copy-toast";

export function CopyApplyLinkButton() {
  const [toast, setToast] = useState<string | null>(null);

  async function copyLink() {
    const url = `${window.location.origin}/partner-apply`;
    try {
      await navigator.clipboard.writeText(url);
      setToast("신청 링크를 복사했습니다.");
    } catch {
      setToast("링크 복사에 실패했습니다. 주소창의 /partner-apply 를 복사해 주세요.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {toast ? <CopyToast message={toast} onDismiss={() => setToast(null)} /> : null}
      <button
        type="button"
        onClick={() => void copyLink()}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
      >
        <Link2 size={16} />
        파트너 신청 링크 복사
      </button>
    </div>
  );
}
