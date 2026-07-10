"use client";

type ContactSummaryCardsProps = {
  activeCount: number;
};

/** 인력/담당자 상단 — 현재 인력 수만 표시 */
export function ContactSummaryCards({ activeCount }: ContactSummaryCardsProps) {
  return (
    <div className="mb-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-medium text-slate-500">현재 인력/담당자</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
          {activeCount.toLocaleString("ko-KR")}
        </p>
      </div>
    </div>
  );
}
