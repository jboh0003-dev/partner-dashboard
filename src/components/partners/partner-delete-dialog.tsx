"use client";

import { useEffect, useState } from "react";
import type { PartnerDeleteMode, PartnerDeleteImpact } from "@/lib/partners/delete-types";

type PartnerDeleteDialogProps = {
  open: boolean;
  title: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (mode: PartnerDeleteMode) => void;
  ids: string[];
};

export function PartnerDeleteDialog({
  open,
  title,
  loading = false,
  onCancel,
  onConfirm,
  ids
}: PartnerDeleteDialogProps) {
  const [mode, setMode] = useState<PartnerDeleteMode>("deactivate_contacts");
  const [impact, setImpact] = useState<PartnerDeleteImpact | null>(null);
  const [impactError, setImpactError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || ids.length === 0) return;
    setMode("deactivate_contacts");
    setImpact(null);
    setImpactError(null);
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/partners/delete-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        impact?: PartnerDeleteImpact;
        message?: string;
      } | null;
      if (cancelled) return;
      if (!response.ok || !json?.ok || !json.impact) {
        setImpactError(json?.message ?? "영향 범위를 불러오지 못했습니다.");
        return;
      }
      setImpact(json.impact);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, ids.join(",")]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-delete-title"
      >
        <h2 id="partner-delete-title" className="text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          파트너는 목록·검색·Partner AI에서 숨김 처리됩니다. 문서와 교육 이력은 보존됩니다.
        </p>

        {impactError ? <p className="mt-3 text-sm text-rose-700">{impactError}</p> : null}
        {impact ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <ImpactStat label="파트너" value={`${impact.partner_count}개`} />
            <ImpactStat label="활성 담당자" value={`${impact.active_contact_count}명`} />
            <ImpactStat label="문서" value={`${impact.document_count}건`} />
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">영향 범위를 확인하는 중…</p>
        )}

        <fieldset className="mt-5 space-y-2" disabled={loading}>
          <legend className="text-xs font-semibold uppercase tracking-wide text-slate-500">삭제 범위</legend>
          <ModeOption
            checked={mode === "partner_only"}
            onChange={() => setMode("partner_only")}
            title="파트너만 숨김"
            description="담당자는 DB에 그대로 둡니다. 다만 삭제된 파트너의 담당자는 목록과 AI에서 보이지 않습니다."
          />
          <ModeOption
            checked={mode === "deactivate_contacts"}
            onChange={() => setMode("deactivate_contacts")}
            title="파트너 + 연결 담당자 비활성화 (권장)"
            description="담당자도 비활성 처리되어 인력 목록 기본 화면에 나오지 않습니다."
          />
          <ModeOption
            checked={mode === "delete_contacts"}
            onChange={() => setMode("delete_contacts")}
            title="파트너 + 연결 담당자 완전 삭제"
            danger
            description="담당자를 삭제 처리합니다. 교육 참석 이력은 남지만 담당자 카드에서는 복구하기 어렵습니다."
          />
        </fieldset>

        {mode === "delete_contacts" ? (
          <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-800">
            위험: 이 작업은 되돌리기 어렵습니다. 테스트 데이터 정리 외에는 권장하지 않습니다.
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="ui-btn-secondary">
            취소
          </button>
          <button
            type="button"
            disabled={loading || !impact}
            onClick={() => onConfirm(mode)}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {loading ? "처리 중..." : "삭제 실행"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImpactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function ModeOption({
  checked,
  onChange,
  title,
  description,
  danger
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer gap-3 rounded-xl border px-3 py-3 text-sm",
        checked
          ? danger
            ? "border-rose-300 bg-rose-50"
            : "border-okestro-300 bg-okestro-50/70"
          : "border-slate-200 bg-white hover:border-slate-300"
      ].join(" ")}
    >
      <input type="radio" className="mt-1" checked={checked} onChange={onChange} />
      <span>
        <span className={`block font-semibold ${danger ? "text-rose-800" : "text-slate-900"}`}>{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
    </label>
  );
}
