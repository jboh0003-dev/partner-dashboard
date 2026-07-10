"use client";

import { useEffect, useState } from "react";
import { CopyToast } from "@/components/common/copy-toast";
import { PARTNER_GRADE_LABEL, PARTNER_GRADE_ORDER } from "@/lib/constants";
import {
  buildPartnerGradeSavePayload,
  getDisplayPartnerGrade
} from "@/lib/partners/grade";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import type { Partner } from "@/types/partner";

type PartnerBasicInfoEditModalProps = {
  partner: Partner;
  open: boolean;
  onClose: () => void;
  onSaved?: (partner: Partner) => void;
};

type FormState = {
  company_name: string;
  external_no: string;
  contract_start_date: string;
  grade: string;
  grade_change_raw: string;
  region_group: string;
  sales_owner: string;
  business_number: string;
  website: string;
  address: string;
  main_phone: string;
  memo: string;
};

function toFormState(partner: Partner): FormState {
  return {
    company_name: partner.company_name,
    external_no: partner.external_no ?? "",
    contract_start_date: partner.contract_start_date ?? "",
    grade: getDisplayPartnerGrade(partner),
    grade_change_raw: partner.grade_change_raw ?? partner.grade_raw ?? "",
    region_group: partner.region_group ?? "",
    sales_owner: partner.sales_owner ?? "",
    business_number: partner.business_number ?? "",
    website: partner.website ?? "",
    address: partner.address ?? "",
    main_phone: partner.main_phone ?? "",
    memo: partner.memo ?? ""
  };
}

export function PartnerBasicInfoEditModal({
  partner,
  open,
  onClose,
  onSaved
}: PartnerBasicInfoEditModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(partner));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(toFormState(partner));
      setError(null);
    }
  }, [open, partner]);

  if (!open) {
    return <CopyToast message={toast} onDismiss={() => setToast(null)} />;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const gradePayload = buildPartnerGradeSavePayload(form.grade);

    const response = await fetch(`/api/partners/${partner.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: form.company_name,
        external_no: form.external_no || null,
        contract_start_date: form.contract_start_date || null,
        grade: gradePayload.grade,
        grade_override: gradePayload.grade_override,
        grade_change_raw: form.grade_change_raw || null,
        region_group: form.region_group || null,
        sales_owner: form.sales_owner || null,
        business_number: form.business_number || null,
        website: form.website || null,
        address: form.address || null,
        main_phone: form.main_phone || null,
        memo: form.memo || null
      })
    });

    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
      partner?: Partner;
    } | null;
    setSaving(false);

    if (!response.ok || !json?.ok) {
      setError(json?.message ?? "저장에 실패했습니다.");
      return;
    }

    setToast("저장되었습니다.");
    if (json.partner) {
      onSaved?.(json.partner as Partner);
    }
    onClose();
  }

  return (
    <>
      <CopyToast message={toast} onDismiss={() => setToast(null)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">기본정보 수정</h2>
            <p className="mt-1 text-xs text-slate-500">
              현재 파트너번호: {formatPartnerNo(partner)}
            </p>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-4">
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            <Field label="회사명 *">
              <input
                required
                value={form.company_name}
                onChange={(event) => setForm((prev) => ({ ...prev, company_name: event.target.value }))}
                className="ui-input w-full"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="파트너번호">
                <input
                  value={form.external_no}
                  onChange={(event) => setForm((prev) => ({ ...prev, external_no: event.target.value }))}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="계약일자">
                <input
                  type="date"
                  value={form.contract_start_date}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, contract_start_date: event.target.value }))
                  }
                  className="ui-input w-full"
                />
              </Field>
              <Field label="등급">
                <select
                  value={form.grade}
                  onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))}
                  className="ui-input w-full"
                >
                  {PARTNER_GRADE_ORDER.map((grade) => (
                    <option key={grade} value={grade}>
                      {PARTNER_GRADE_LABEL[grade] ?? grade}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="등급 변경 예정 (원문)">
                <input
                  value={form.grade_change_raw}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, grade_change_raw: event.target.value }))
                  }
                  className="ui-input w-full"
                  placeholder="예: Gold 승격 예정"
                />
              </Field>
              <Field label="광역그룹">
                <input
                  value={form.region_group}
                  onChange={(event) => setForm((prev) => ({ ...prev, region_group: event.target.value }))}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="영업담당자">
                <input
                  value={form.sales_owner}
                  onChange={(event) => setForm((prev) => ({ ...prev, sales_owner: event.target.value }))}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="사업자번호">
                <input
                  value={form.business_number}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, business_number: event.target.value }))
                  }
                  className="ui-input w-full"
                />
              </Field>
              <Field label="대표전화">
                <input
                  value={form.main_phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, main_phone: event.target.value }))}
                  className="ui-input w-full"
                />
              </Field>
            </div>

            <Field label="홈페이지">
              <input
                value={form.website}
                onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
                className="ui-input w-full"
              />
            </Field>

            <Field label="주소">
              <textarea
                value={form.address}
                onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                className="ui-input min-h-[80px] w-full"
              />
            </Field>

            <Field label="비고">
              <textarea
                value={form.memo}
                onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
                className="ui-input min-h-[80px] w-full"
              />
            </Field>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} className="ui-btn-secondary">
                취소
              </button>
              <button type="submit" disabled={saving} className="ui-btn-primary disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}
