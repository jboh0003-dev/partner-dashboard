"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyToast } from "@/components/common/copy-toast";
import { CONTACT_ROLE_LABEL } from "@/lib/constants";
import { getContactAssignmentLabel } from "@/lib/contacts/display";
import { validateEmail } from "@/lib/partners/validators";
import type { PartnerContact } from "@/types/partner";

type PartnerOption = { id: string; company_name: string };

type EmailRow = {
  id?: string;
  email: string;
  is_primary: boolean;
  is_bounced: boolean;
  is_sendable: boolean;
  _delete?: boolean;
};

type PhoneRow = {
  id?: string;
  phone: string;
  is_primary: boolean;
  _delete?: boolean;
};

type RoleRow = {
  id?: string;
  role_name: string;
  _delete?: boolean;
};

type PartnerContactFormModalProps = {
  open: boolean;
  onClose: () => void;
  contact?: PartnerContact | null;
  partnerId?: string;
  partnerOptions?: PartnerOption[];
  defaultPartnerId?: string;
  fullEdit?: boolean;
};

type FormState = {
  partner_id: string;
  name: string;
  role_raw: string;
  role_type: string;
  department: string;
  position: string;
  phone: string;
  email: string;
  is_contract_contact: boolean;
  memo: string;
  is_active: boolean;
  review_required: boolean;
  review_reason: string;
  emails: EmailRow[];
  phones: PhoneRow[];
  roles: RoleRow[];
};

const ROLE_TYPE_OPTIONS = Object.entries(CONTACT_ROLE_LABEL);

function emptyFormState(partnerId?: string, defaultPartnerId?: string): FormState {
  return {
    partner_id: partnerId ?? defaultPartnerId ?? "",
    name: "",
    role_raw: "",
    role_type: "etc",
    department: "",
    position: "",
    phone: "",
    email: "",
    is_contract_contact: false,
    memo: "",
    is_active: true,
    review_required: false,
    review_reason: "",
    emails: [],
    phones: [],
    roles: []
  };
}

function toFormState(
  contact: PartnerContact | null | undefined,
  partnerId?: string,
  defaultPartnerId?: string
): FormState {
  if (!contact) return emptyFormState(partnerId, defaultPartnerId);

  return {
    partner_id: contact.partner_id,
    name: contact.name,
    role_raw: contact.role_raw ?? getContactAssignmentLabel(contact) ?? "",
    role_type: contact.role_type ?? "etc",
    department: contact.department ?? "",
    position: contact.position ?? "",
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    is_contract_contact: contact.is_contract_contact,
    memo: contact.memo ?? "",
    is_active: contact.is_active ?? true,
    review_required: contact.review_required ?? false,
    review_reason: contact.review_reason ?? "",
    emails: [],
    phones: [],
    roles: []
  };
}

export function PartnerContactFormModal({
  open,
  onClose,
  contact,
  partnerId,
  partnerOptions,
  defaultPartnerId,
  fullEdit = false
}: PartnerContactFormModalProps) {
  const router = useRouter();
  const isEdit = Boolean(contact);
  const [form, setForm] = useState<FormState>(() =>
    toFormState(contact, partnerId, defaultPartnerId)
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const base = toFormState(contact, partnerId, defaultPartnerId);
    setForm(base);
    setError(null);
    setWarnings([]);

    if (!fullEdit || !contact?.id) return;

    let cancelled = false;
    setLoading(true);

    void fetch(`/api/contacts/${contact.id}`)
      .then((response) => response.json())
      .then((json: {
        ok?: boolean;
        contact?: PartnerContact;
        emails?: Array<{
          id: string;
          email: string;
          is_primary: boolean;
          is_bounced: boolean;
          is_sendable: boolean;
        }>;
        phones?: Array<{ id: string; phone: string; is_primary: boolean }>;
        roles?: Array<{ id: string; role_name: string }>;
      }) => {
        if (cancelled || !json.ok || !json.contact) return;

        setForm({
          ...toFormState(json.contact, partnerId, defaultPartnerId),
          emails: (json.emails ?? []).map((row) => ({
            id: row.id,
            email: row.email,
            is_primary: row.is_primary,
            is_bounced: row.is_bounced,
            is_sendable: row.is_sendable
          })),
          phones: (json.phones ?? []).map((row) => ({
            id: row.id,
            phone: row.phone,
            is_primary: row.is_primary
          })),
          roles: (json.roles ?? []).map((row) => ({
            id: row.id,
            role_name: row.role_name
          }))
        });
      })
      .catch(() => {
        if (!cancelled) setError("담당자 상세 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, contact, partnerId, defaultPartnerId, fullEdit]);

  if (!open) {
    return <CopyToast message={toast} onDismiss={() => setToast(null)} />;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setWarnings([]);

    const resolvedPartnerId = partnerId ?? form.partner_id;
    if (!resolvedPartnerId) {
      setError("파트너를 선택해 주세요.");
      setSaving(false);
      return;
    }

    const emailCheck = validateEmail(form.email);
    if (!emailCheck.valid) {
      setError(emailCheck.warning ?? "이메일 형식이 올바르지 않습니다.");
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      partner_id: resolvedPartnerId,
      name: form.name,
      role_raw: form.role_raw || null,
      role_type: form.role_type || null,
      department: form.department || null,
      position: form.position || null,
      phone: form.phone || null,
      email: form.email || null,
      is_contract_contact: form.is_contract_contact,
      memo: form.memo || null
    };

    if (fullEdit) {
      payload.is_active = form.is_active;
      payload.review_required = form.review_required;
      payload.review_reason = form.review_reason || null;
      payload.emails = form.emails;
      payload.phones = form.phones;
      payload.roles = form.roles;
    }

    const response = await fetch(isEdit ? `/api/contacts/${contact!.id}` : "/api/contacts", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const json = (await response.json().catch(() => null)) as {
      ok?: boolean;
      message?: string;
      warnings?: string[];
    } | null;

    setSaving(false);

    if (!response.ok || !json?.ok) {
      setError(json?.message ?? "저장에 실패했습니다.");
      return;
    }

    const nextWarnings = [...(emailCheck.warning ? [emailCheck.warning] : []), ...(json.warnings ?? [])];
    if (nextWarnings.length) setWarnings(nextWarnings);

    setToast("저장되었습니다.");
    onClose();
    router.refresh();
  }

  function updateEmail(index: number, patch: Partial<EmailRow>) {
    setForm((prev) => {
      const emails = [...prev.emails];
      emails[index] = { ...emails[index]!, ...patch };
      if (patch.is_primary) {
        emails.forEach((row, rowIndex) => {
          if (rowIndex !== index) row.is_primary = false;
        });
      }
      return { ...prev, emails };
    });
  }

  function updatePhone(index: number, patch: Partial<PhoneRow>) {
    setForm((prev) => {
      const phones = [...prev.phones];
      phones[index] = { ...phones[index]!, ...patch };
      if (patch.is_primary) {
        phones.forEach((row, rowIndex) => {
          if (rowIndex !== index) row.is_primary = false;
        });
      }
      return { ...prev, phones };
    });
  }

  return (
    <>
      <CopyToast message={toast} onDismiss={() => setToast(null)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? "담당자 수정" : "담당자 추가"}
            </h2>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-4">
            {loading ? (
              <p className="text-sm text-slate-500">상세 정보 불러오는 중...</p>
            ) : null}

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

            {!partnerId && partnerOptions && partnerOptions.length > 0 ? (
              <Field label="파트너사 *">
                <select
                  required
                  value={form.partner_id}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, partner_id: event.target.value }))
                  }
                  className="ui-input w-full"
                >
                  <option value="">파트너 선택</option>
                  {partnerOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.company_name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="이름 *">
              <input
                required
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="ui-input w-full"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="담당 업무">
                <input
                  value={form.role_raw}
                  onChange={(event) => setForm((prev) => ({ ...prev, role_raw: event.target.value }))}
                  className="ui-input w-full"
                  placeholder="예: 영업 / 엔지니어"
                />
              </Field>
              <Field label="담당 구분">
                <select
                  value={form.role_type}
                  onChange={(event) => setForm((prev) => ({ ...prev, role_type: event.target.value }))}
                  className="ui-input w-full"
                >
                  {ROLE_TYPE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="부서">
                <input
                  value={form.department}
                  onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="직급">
                <input
                  value={form.position}
                  onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="대표 연락처">
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  className="ui-input w-full"
                />
              </Field>
              <Field label="대표 이메일">
                <input
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="ui-input w-full"
                  placeholder="name@company.com"
                />
              </Field>
            </div>

            {fullEdit ? (
              <>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">추가 이메일</p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-700"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          emails: [
                            ...prev.emails,
                            {
                              email: "",
                              is_primary: prev.emails.length === 0,
                              is_bounced: false,
                              is_sendable: true
                            }
                          ]
                        }))
                      }
                    >
                      + 추가
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.emails.map((row, index) => (
                      <div key={row.id ?? `new-email-${index}`} className="grid gap-2 md:grid-cols-[1fr_auto]">
                        <input
                          value={row.email}
                          onChange={(event) => updateEmail(index, { email: event.target.value })}
                          className="ui-input w-full"
                          placeholder="email@company.com"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              checked={row.is_primary}
                              onChange={() => updateEmail(index, { is_primary: true })}
                            />
                            대표
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={row.is_sendable}
                              onChange={(event) =>
                                updateEmail(index, { is_sendable: event.target.checked })
                              }
                            />
                            발송가능
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={row.is_bounced}
                              onChange={(event) =>
                                updateEmail(index, { is_bounced: event.target.checked })
                              }
                            />
                            반송
                          </label>
                          <button
                            type="button"
                            className="text-rose-700"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                emails: prev.emails.filter((_, rowIndex) => rowIndex !== index)
                              }))
                            }
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">추가 연락처</p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-700"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          phones: [
                            ...prev.phones,
                            { phone: "", is_primary: prev.phones.length === 0 }
                          ]
                        }))
                      }
                    >
                      + 추가
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.phones.map((row, index) => (
                      <div key={row.id ?? `new-phone-${index}`} className="flex flex-wrap items-center gap-2">
                        <input
                          value={row.phone}
                          onChange={(event) => updatePhone(index, { phone: event.target.value })}
                          className="ui-input min-w-[180px] flex-1"
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="radio"
                            checked={row.is_primary}
                            onChange={() => updatePhone(index, { is_primary: true })}
                          />
                          대표
                        </label>
                        <button
                          type="button"
                          className="text-xs text-rose-700"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              phones: prev.phones.filter((_, rowIndex) => rowIndex !== index)
                            }))
                          }
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600">담당구분(역할)</p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-blue-700"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          roles: [...prev.roles, { role_name: "" }]
                        }))
                      }
                    >
                      + 추가
                    </button>
                  </div>
                  <div className="space-y-2">
                    {form.roles.map((row, index) => (
                      <div key={row.id ?? `new-role-${index}`} className="flex items-center gap-2">
                        <input
                          value={row.role_name}
                          onChange={(event) =>
                            setForm((prev) => {
                              const roles = [...prev.roles];
                              roles[index] = { ...roles[index]!, role_name: event.target.value };
                              return { ...prev, roles };
                            })
                          }
                          className="ui-input flex-1"
                        />
                        <button
                          type="button"
                          className="text-xs text-rose-700"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              roles: prev.roles.filter((_, rowIndex) => rowIndex !== index)
                            }))
                          }
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, is_active: event.target.checked }))
                      }
                    />
                    활성 (active)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.review_required}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, review_required: event.target.checked }))
                      }
                    />
                    검토 필요 (review_required)
                  </label>
                </div>

                {form.review_required ? (
                  <Field label="검토 사유">
                    <input
                      value={form.review_reason}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, review_reason: event.target.value }))
                      }
                      className="ui-input w-full"
                    />
                  </Field>
                ) : null}
              </>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_contract_contact}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, is_contract_contact: event.target.checked }))
                }
              />
              계약담당자
            </label>

            <Field label="비고">
              <textarea
                value={form.memo}
                onChange={(event) => setForm((prev) => ({ ...prev, memo: event.target.value }))}
                className="ui-input min-h-[72px] w-full"
              />
            </Field>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button type="button" onClick={onClose} className="ui-btn-secondary">
                취소
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                className="ui-btn-primary disabled:opacity-50"
              >
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
