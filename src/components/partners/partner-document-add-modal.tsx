"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyToast } from "@/components/common/copy-toast";
import {
  getManualUploadTypeLabel,
  MANUAL_UPLOAD_DOCUMENT_TYPES,
  MANUAL_UPLOAD_MAX_BYTES
} from "@/lib/documents/manual-upload";

type PartnerDocumentAddModalProps = {
  open: boolean;
  partnerId: string;
  onClose: () => void;
};

type ExistingDocument = {
  id: string;
  display_name: string | null;
  document_type: string | null;
  document_type_label: string;
};

type FormState = {
  document_type: string;
  display_name: string;
  contract_date: string;
  received_date: string;
  note: string;
  mode: "replace" | "add";
};

const defaultForm = (): FormState => ({
  document_type: "partner_contract",
  display_name: "",
  contract_date: "",
  received_date: "",
  note: "",
  mode: "replace"
});

export function PartnerDocumentAddModal({
  open,
  partnerId,
  onClose
}: PartnerDocumentAddModalProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [file, setFile] = useState<File | null>(null);
  const [existing, setExisting] = useState<ExistingDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(defaultForm());
    setFile(null);
    setExisting(null);
    setError(null);
    setWarnings([]);
  }, [open]);

  useEffect(() => {
    if (!open || !form.document_type) return;

    void (async () => {
      const response = await fetch(
        `/api/partners/${partnerId}/documents?document_type=${encodeURIComponent(form.document_type)}`
      );
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        existing?: ExistingDocument | null;
      } | null;
      setExisting(json?.existing ?? null);
      if (json?.existing) {
        setForm((prev) => ({ ...prev, mode: "replace" }));
      }
    })();
  }, [open, partnerId, form.document_type]);

  if (!open) {
    return <CopyToast message={toast} onDismiss={() => setToast(null)} />;
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    setFile(nextFile);
    if (nextFile && !form.display_name.trim()) {
      setForm((prev) => ({ ...prev, display_name: nextFile.name }));
    }
    if (nextFile && nextFile.size > MANUAL_UPLOAD_MAX_BYTES) {
      setWarnings(["파일 크기가 20MB를 초과합니다. 업로드 전 용량을 줄여 주세요."]);
    } else {
      setWarnings([]);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setWarnings([]);

    if (!file) {
      setError("업로드할 파일을 선택해 주세요.");
      setSaving(false);
      return;
    }

    if (file.size > MANUAL_UPLOAD_MAX_BYTES) {
      setError("파일 크기는 20MB를 초과할 수 없습니다.");
      setSaving(false);
      return;
    }

    const response = await fetch(`/api/partners/${partnerId}/documents`, {
      method: "POST",
      body: (() => {
        const formData = new FormData();
        formData.set("file", file);
        formData.set(
          "metadata",
          JSON.stringify({
            document_type: form.document_type,
            display_name: form.display_name,
            contract_date: form.contract_date || null,
            received_date: form.received_date || null,
            note: form.note || null,
            mode: form.mode
          })
        );
        return formData;
      })()
    });

    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
      warnings?: string[];
    } | null;

    setSaving(false);

    if (!response.ok || !json?.ok) {
      setError(json?.message ?? "문서 업로드에 실패했습니다.");
      return;
    }

    if (json.warnings?.length) {
      setWarnings(json.warnings);
    }

    setToast("문서가 저장되었습니다.");
    onClose();
    router.refresh();
  }

  return (
    <>
      <CopyToast message={toast} onDismiss={() => setToast(null)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">문서 추가</h2>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-4">
            {error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </div>
            ) : null}
            {warnings.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}

            <Field label="문서 구분 *">
              <select
                required
                value={form.document_type}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, document_type: event.target.value }))
                }
                className="ui-input w-full"
              >
                {MANUAL_UPLOAD_DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {getManualUploadTypeLabel(type)}
                  </option>
                ))}
              </select>
            </Field>

            {existing ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p>
                  이미 같은 문서 구분이 존재합니다:{" "}
                  <span className="font-semibold">{existing.display_name ?? "문서"}</span>
                </p>
                <div className="mt-2 space-y-1">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.mode === "replace"}
                      onChange={() => setForm((prev) => ({ ...prev, mode: "replace" }))}
                    />
                    기존 문서 교체 (권장)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.mode === "add"}
                      onChange={() => setForm((prev) => ({ ...prev, mode: "add" }))}
                    />
                    새 문서로 추가
                  </label>
                </div>
              </div>
            ) : null}

            <Field label="표시 파일명 *">
              <input
                required
                value={form.display_name}
                onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))}
                className="ui-input w-full"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="계약일 또는 문서일자">
                <input
                  type="date"
                  value={form.contract_date}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, contract_date: event.target.value }))
                  }
                  className="ui-input w-full"
                />
              </Field>
              <Field label="등록일">
                <input
                  type="date"
                  value={form.received_date}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, received_date: event.target.value }))
                  }
                  className="ui-input w-full"
                />
              </Field>
            </div>

            <Field label="파일 업로드 *">
              <input
                required
                type="file"
                onChange={handleFileChange}
                className="ui-input w-full"
              />
              {file ? (
                <p className="mt-1 text-xs text-slate-500">
                  {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              ) : null}
            </Field>

            <Field label="비고">
              <textarea
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                className="ui-input min-h-[72px] w-full"
              />
            </Field>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} className="ui-btn-secondary">
                취소
              </button>
              <button type="submit" disabled={saving} className="ui-btn-primary disabled:opacity-50">
                {saving ? "업로드 중..." : "저장"}
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
