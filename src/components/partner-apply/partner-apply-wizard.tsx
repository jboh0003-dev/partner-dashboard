"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  APPLICATION_WIZARD_STEPS,
  EMPTY_APPLICATION_FORM,
  type MissingField,
  type PartnerApplicationFormPayload,
  type WizardStepId
} from "@/lib/partner-applications/types";
import {
  collectMissingFields,
  formatBusinessNumberInput,
  formatPhoneInput
} from "@/lib/partner-applications/validation";
import { recommendedDocumentFileName } from "@/lib/partner-applications/filename-guide";

type Props = {
  initialId?: string;
  initialToken?: string;
};

type DocMeta = {
  id: string;
  document_type: string;
  file_name: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "작성 중",
  submitted: "제출 완료",
  under_review: "검토 중",
  revision_requested: "보완 요청",
  approved: "승인",
  rejected: "반려",
  contracted: "계약 완료"
};

function RequiredMark() {
  return <span className="text-red-600">*</span>;
}

function FieldError({ show, message }: { show?: boolean; message: string }) {
  if (!show) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function PartnerApplyWizard({ initialId, initialToken }: Props) {
  const [step, setStep] = useState<WizardStepId>("intro");
  const [form, setForm] = useState<PartnerApplicationFormPayload>(EMPTY_APPLICATION_FORM);
  const [applicationId, setApplicationId] = useState<string | null>(initialId ?? null);
  const [token, setToken] = useState<string | null>(initialToken ?? null);
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [lookupPassword, setLookupPassword] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("draft");
  const [documents, setDocuments] = useState<DocMeta[]>([]);
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittedDone, setSubmittedDone] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupPw, setLookupPw] = useState("");
  const [pending, startTransition] = useTransition();
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [revisionReason, setRevisionReason] = useState<string | null>(null);
  const [autoJumpMissing, setAutoJumpMissing] = useState(true);
  const [focusField, setFocusField] = useState<string | null>(null);

  const hasBizDoc = documents.some((d) => d.document_type === "business_registration");
  const liveMissing = useMemo(
    () => collectMissingFields(form, { hasBusinessRegistrationDoc: hasBizDoc }),
    [form, hasBizDoc]
  );

  const progress = useMemo(() => {
    const idx = APPLICATION_WIZARD_STEPS.findIndex((s) => s.id === step);
    return Math.round(((idx + 1) / APPLICATION_WIZARD_STEPS.length) * 100);
  }, [step]);

  const editable = status === "draft" || status === "revision_requested";

  useEffect(() => {
    if (!initialId || !initialToken) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/public/partner-applications/${initialId}?token=${encodeURIComponent(initialToken)}`
      );
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "신청서를 불러오지 못했습니다.");
        return;
      }
      setApplicationId(json.application.id);
      setToken(initialToken);
      setApplicationNumber(json.application.application_number);
      setStatus(json.application.status);
      setForm(json.application.form || EMPTY_APPLICATION_FORM);
      setDocuments(json.application.documents || []);
      setRevisionReason(json.application.revision_reason || null);
      if (json.application.status === "submitted") setSubmittedDone(true);
    });
  }, [initialId, initialToken]);

  useEffect(() => {
    if (!focusField) return;
    const el = document.querySelector<HTMLInputElement>(`[data-field="${focusField}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
    setFocusField(null);
  }, [step, focusField]);

  function scheduleAutosave(next: PartnerApplicationFormPayload) {
    if (!applicationId || !token || !editable) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persist(next, false);
    }, 1200);
  }

  function updateForm(mutator: (prev: PartnerApplicationFormPayload) => PartnerApplicationFormPayload) {
    setForm((prev) => {
      const next = mutator(prev);
      scheduleAutosave(next);
      return next;
    });
  }

  async function startApplication() {
    setError(null);
    const res = await fetch("/api/public/partner-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        honeypot,
        applicant_name: form.applicant.name,
        applicant_email: form.applicant.email
      })
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.message || "시작 실패");
      return;
    }
    setApplicationId(json.application_id);
    setToken(json.access_token);
    setApplicationNumber(json.application_number);
    setLookupPassword(json.lookup_password);
    setStatus("draft");
    window.history.replaceState(
      null,
      "",
      `/partner-apply/${json.application_id}?token=${encodeURIComponent(json.access_token)}`
    );
    setStep("company");
    setMessage(
      `신청번호 ${json.application_number} / 조회 비밀번호 ${json.lookup_password} 를 보관해주세요.`
    );
  }

  async function persist(nextForm: PartnerApplicationFormPayload, showMsg: boolean) {
    if (!applicationId || !token) return;
    const res = await fetch(`/api/public/partner-applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, form: nextForm, honeypot })
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.message || "임시저장 실패");
      return;
    }
    setMissing(json.missing || []);
    if (showMsg) setMessage("임시저장되었습니다.");
  }

  async function submit() {
    if (!applicationId || !token) return;
    setError(null);
    if (liveMissing.length) {
      if (autoJumpMissing) goMissing();
      return;
    }
    await persist(form, false);
    const res = await fetch(`/api/public/partner-applications/${applicationId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, form, honeypot })
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.message || "제출 실패");
      setMissing(json.missing || []);
      return;
    }
    setStatus("submitted");
    setSubmittedDone(true);
    setMessage(`제출 완료. 신청번호: ${json.application_number}`);
  }

  async function uploadDoc(documentType: string, file: File) {
    if (!applicationId || !token) return;
    const fd = new FormData();
    fd.set("token", token);
    fd.set("document_type", documentType);
    fd.set("file", file);
    fd.set("honeypot", honeypot);
    const res = await fetch(`/api/public/partner-applications/${applicationId}/documents`, {
      method: "POST",
      body: fd
    });
    const json = await res.json();
    if (!json.ok) {
      const raw = String(json.message || "");
      setError(
        /invalid key|storage/i.test(raw)
          ? "파일 업로드에 실패했습니다. 다시 시도해 주세요."
          : raw || "파일 업로드에 실패했습니다. 다시 시도해 주세요."
      );
      return;
    }
    setDocuments((prev) => [
      {
        id: json.document_id,
        document_type: documentType,
        file_name: file.name
      },
      ...prev.filter((d) => d.document_type !== documentType)
    ]);
    setMessage("파일이 업로드되었습니다.");
  }

  async function deleteDoc(documentId: string) {
    if (!applicationId || !token) return;
    const res = await fetch(`/api/public/partner-applications/${applicationId}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, document_id: documentId, honeypot })
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.message || "파일 삭제에 실패했습니다. 다시 시도해 주세요.");
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== documentId));
    setMessage("파일을 삭제했습니다.");
  }

  async function lookup() {
    setError(null);
    const res = await fetch("/api/public/partner-applications/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_number: lookupNumber || undefined,
        email: lookupEmail || undefined,
        lookup_password: lookupPw
      })
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.message || "조회 실패");
      return;
    }
    window.location.href = json.resume_path;
  }

  function goMissing(fromSection?: string) {
    const list = liveMissing.length ? liveMissing : missing;
    if (!list.length) return;
    const map: Record<string, WizardStepId> = {
      company: "company",
      contact: "contact",
      people: "people",
      customers: "customers",
      equipment: "equipment",
      engineers: "engineers",
      documents: "documents"
    };
    const order = APPLICATION_WIZARD_STEPS.map((s) => s.id);
    const startIdx = fromSection ? order.indexOf(fromSection as WizardStepId) : -1;
    const nextItem =
      startIdx >= 0
        ? (list.find((item) => order.indexOf(map[item.section] || "review") > startIdx) ?? list[0])
        : list[0];
    if (!nextItem) return;
    setStep(map[nextItem.section] || "review");
    setFocusField(nextItem.field);
  }

  if (submittedDone && status === "submitted") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">신청이 제출되었습니다</h1>
        <p className="mt-3 text-slate-600">
          신청번호: <strong>{applicationNumber}</strong>
        </p>
        {lookupPassword ? (
          <p className="mt-2 text-sm text-slate-600">
            조회 비밀번호: <strong>{lookupPassword}</strong>
          </p>
        ) : null}
        <p className="mt-4 text-sm text-slate-500">
          검토 결과는 신청 담당자 연락처로 안내됩니다.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
            onClick={() => {
              setSubmittedDone(false);
              setStep("intro");
            }}
          >
            신청 상태 조회
          </button>
          <Link href="/partner-apply" className="text-center text-xs text-slate-500 underline">
            새 신청 작성
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="text-sm font-medium text-slate-500">오케스트로 파트너 신청</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
          오케스트로 파트너 신청
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          파트너십 신청서를 작성하고 제출하는 공개 페이지입니다. 로그인 없이 이용할 수 있습니다.
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-slate-800 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
          {APPLICATION_WIZARD_STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={`rounded-full px-2.5 py-1 ${
                step === s.id ? "bg-slate-900 text-white" : "bg-slate-100"
              }`}
            >
              {s.label}
              {s.required ? " *" : ""}
            </button>
          ))}
        </div>
        {applicationNumber ? (
          <p className="mt-3 text-sm text-slate-600">
            신청번호 {applicationNumber} · 상태 {STATUS_LABEL[status] || status}
            {pending ? " · 저장 중…" : ""}
          </p>
        ) : null}
        {revisionReason ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            보완 요청: {revisionReason}
          </p>
        ) : null}
        {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </header>

      {/* honeypot */}
      <input
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        aria-hidden
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {step === "intro" ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">신청 안내</h2>
            <p className="text-sm leading-6 text-slate-600">
              본 포털은 오케스트로 파트너십 신청을 위한 외부 입력 화면입니다. 필수 항목을 모두
              입력한 뒤 제출해주세요. 작성 중 내용은 자동으로 임시저장됩니다.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>사업자등록증 첨부는 필수입니다.</li>
              <li>기술 전담인원·장비·기술인력 프로필은 선택 항목입니다.</li>
              <li>기존 엑셀 신청서 업로드 방식은 관리자 대시보드에서 계속 사용할 수 있습니다.</li>
            </ul>

            {!applicationId ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  신청자 성명
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={form.applicant.name}
                    onChange={(e) =>
                      updateForm((f) => ({
                        ...f,
                        applicant: { ...f.applicant, name: e.target.value }
                      }))
                    }
                  />
                </label>
                <label className="text-sm">
                  신청자 이메일
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={form.applicant.email}
                    onChange={(e) =>
                      updateForm((f) => ({
                        ...f,
                        applicant: { ...f.applicant, email: e.target.value }
                      }))
                    }
                  />
                </label>
              </div>
            ) : null}

            {!applicationId ? (
              <button
                type="button"
                onClick={() => void startApplication()}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                신청 시작
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep("company")}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                이어서 작성
              </button>
            )}

            <div className="border-t pt-4">
              <h3 className="font-medium">기존 신청 조회 / 이어쓰기</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input
                  placeholder="신청번호"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={lookupNumber}
                  onChange={(e) => setLookupNumber(e.target.value)}
                />
                <input
                  placeholder="또는 이메일"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                />
                <input
                  placeholder="조회 비밀번호"
                  className="rounded-lg border px-3 py-2 text-sm"
                  value={lookupPw}
                  onChange={(e) => setLookupPw(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => void lookup()}
                className="mt-2 rounded-lg border px-3 py-2 text-sm"
              >
                조회
              </button>
            </div>
          </div>
        ) : null}

        {step === "company" ? (
          <CompanyStep form={form} updateForm={updateForm} missing={liveMissing} editable={editable} />
        ) : null}
        {step === "contact" ? (
          <ContactStep form={form} updateForm={updateForm} missing={liveMissing} editable={editable} />
        ) : null}
        {step === "people" ? (
          <PeopleStep form={form} updateForm={updateForm} missing={liveMissing} editable={editable} />
        ) : null}
        {step === "customers" ? (
          <CustomersStep form={form} updateForm={updateForm} missing={liveMissing} editable={editable} />
        ) : null}
        {step === "strategy" ? (
          <div>
            <h2 className="text-xl font-semibold">
              영업전략 <span className="text-sm font-normal text-slate-500">(선택)</span>
            </h2>
            <textarea
              disabled={!editable}
              className="mt-3 min-h-40 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.sales_strategy}
              onChange={(e) => updateForm((f) => ({ ...f, sales_strategy: e.target.value }))}
            />
          </div>
        ) : null}
        {step === "equipment" ? (
          <EquipmentStep form={form} updateForm={updateForm} missing={liveMissing} editable={editable} />
        ) : null}
        {step === "engineers" ? (
          <EngineersStep form={form} updateForm={updateForm} missing={liveMissing} editable={editable} />
        ) : null}
        {step === "documents" ? (
          <div>
            <h2 className="text-xl font-semibold">첨부서류</h2>
            <p className="mt-1 text-sm text-slate-600">
              사업자등록증 <RequiredMark /> (필수) · 회사소개서/재무자료/기타는 선택
            </p>
            <FieldError
              show={liveMissing.some((m) => m.field === "business_registration")}
              message="사업자등록증을 업로드해주세요."
            />
            <div className="mt-4 space-y-3">
              {(
                [
                  ["business_registration", "사업자등록증 *"],
                  ["company_intro", "회사소개서 (선택)"],
                  ["financial", "재무자료 (선택)"],
                  ["other", "기타 (선택)"]
                ] as const
              ).map(([type, label]) => (
                <label key={type} className="block text-sm">
                  {label}
                  <input
                    disabled={!editable}
                    type="file"
                    accept=".pdf,.xlsx,.docx,.png,.jpg,.jpeg"
                    className="mt-1 block w-full text-sm"
                    data-field={type === "business_registration" ? "business_registration" : undefined}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadDoc(type, f);
                    }}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    권장 파일명: {recommendedDocumentFileName(type, form.company.company_name)}
                  </p>
                  {documents.find((d) => d.document_type === type) ? (
                    <span className="mt-1 flex items-center gap-2 text-xs text-emerald-700">
                      업로드됨: {documents.find((d) => d.document_type === type)?.file_name}
                      {editable ? (
                        <button
                          type="button"
                          className="text-red-600 underline"
                          onClick={() => {
                            const doc = documents.find((d) => d.document_type === type);
                            if (doc) void deleteDoc(doc.id);
                          }}
                        >
                          삭제
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        {step === "review" ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">최종 확인 및 제출</h2>
            <p className="text-sm text-slate-600">
              필수 입력 {liveMissing.length}개 남음
            </p>
            {liveMissing.length ? (
              <ul className="list-disc pl-5 text-sm text-red-600">
                {liveMissing.map((m) => (
                  <li key={`${m.section}-${m.field}`}>{m.label}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-emerald-700">필수 항목이 모두 입력되었습니다.</p>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={autoJumpMissing}
                onChange={(e) => setAutoJumpMissing(e.target.checked)}
              />
              누락 항목 자동 이동
            </label>
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              <p>기업명: {form.company.company_name || "-"}</p>
              <p>사업자등록번호: {form.company.business_registration_number || "-"}</p>
              <p>담당자: {form.contact.name || "-"} / {form.contact.email || "-"}</p>
              <p>영업 전담: {form.people.sales.filter((p) => p.name).length}명</p>
              <p>주요고객: {form.customers.filter((c) => c.customer_name).length}건</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {liveMissing.length ? (
                <button type="button" onClick={() => goMissing()} className="rounded-lg border px-3 py-2 text-sm">
                  누락 항목으로 이동
                </button>
              ) : null}
              <button
                type="button"
                disabled={!editable}
                onClick={() => void submit()}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                최종 제출
              </button>
              <button
                type="button"
                disabled={!editable || !applicationId}
                onClick={() => void persist(form, true)}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                임시저장
              </button>
            </div>
          </div>
        ) : null}

        {step !== "intro" && step !== "review" ? (
          <div className="mt-6 flex justify-between border-t pt-4">
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => {
                const idx = APPLICATION_WIZARD_STEPS.findIndex((s) => s.id === step);
                if (idx > 0) setStep(APPLICATION_WIZARD_STEPS[idx - 1].id);
              }}
            >
              이전
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
              onClick={() => {
                const idx = APPLICATION_WIZARD_STEPS.findIndex((s) => s.id === step);
                if (autoJumpMissing && liveMissing.length) {
                  const remaining = liveMissing.filter((item) => item.section !== step);
                  if (liveMissing.some((item) => item.section === step)) {
                    goMissing();
                    return;
                  }
                  if (remaining.length) {
                    goMissing(step);
                    return;
                  }
                }
                if (idx < APPLICATION_WIZARD_STEPS.length - 1) {
                  setStep(APPLICATION_WIZARD_STEPS[idx + 1].id);
                }
              }}
            >
              다음
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

type StepProps = {
  form: PartnerApplicationFormPayload;
  updateForm: (
    mutator: (prev: PartnerApplicationFormPayload) => PartnerApplicationFormPayload
  ) => void;
  missing: MissingField[];
  editable: boolean;
};

function hasMiss(missing: MissingField[], field: string) {
  return missing.some((m) => m.field === field || m.field.startsWith(field));
}

function CompanyStep({ form, updateForm, missing, editable }: StepProps) {
  const c = form.company;
  const set = (key: keyof typeof c, value: string) =>
    updateForm((f) => ({ ...f, company: { ...f.company, [key]: value } }));
  return (
    <div>
      <h2 className="text-xl font-semibold">기업현황</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          기업명 <RequiredMark />
          <input disabled={!editable} data-field="company_name" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.company_name} onChange={(e) => set("company_name", e.target.value)} />
          <FieldError show={hasMiss(missing, "company_name")} message="기업명을 입력하세요." />
        </label>
        <label className="text-sm">
          사업자등록번호 <RequiredMark />
          <input
            disabled={!editable}
            data-field="business_registration_number"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={c.business_registration_number}
            onChange={(e) => set("business_registration_number", formatBusinessNumberInput(e.target.value))}
          />
          <FieldError show={hasMiss(missing, "business_registration_number")} message="올바른 사업자등록번호를 입력하세요." />
        </label>
        <label className="text-sm">
          대표자명 <RequiredMark />
          <input disabled={!editable} data-field="representative_name" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.representative_name} onChange={(e) => set("representative_name", e.target.value)} />
          <FieldError show={hasMiss(missing, "representative_name")} message="대표자명을 입력하세요." />
        </label>
        <label className="text-sm">
          설립일자 <RequiredMark />
          <input disabled={!editable} data-field="established_date" className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="YYYY-MM-DD 또는 2021년 1월" value={c.established_date} onChange={(e) => set("established_date", e.target.value)} />
          <FieldError show={hasMiss(missing, "established_date")} message="설립일자를 입력하세요." />
        </label>
        <label className="text-sm sm:col-span-2">
          주소 <RequiredMark />
          <input disabled={!editable} data-field="address" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.address} onChange={(e) => set("address", e.target.value)} />
          <FieldError show={hasMiss(missing, "address")} message="주소를 입력하세요." />
        </label>
        <label className="text-sm">홈페이지<input disabled={!editable} className="mt-1 w-full rounded-lg border px-3 py-2" value={c.website} onChange={(e) => set("website", e.target.value)} /></label>
        <label className="text-sm">신용등급<input disabled={!editable} className="mt-1 w-full rounded-lg border px-3 py-2" value={c.credit_grade} onChange={(e) => set("credit_grade", e.target.value)} /></label>
        <label className="text-sm">매출액<input disabled={!editable} className="mt-1 w-full rounded-lg border px-3 py-2" value={c.revenue} onChange={(e) => set("revenue", e.target.value)} /></label>
        <label className="text-sm">전체 임직원 수 <RequiredMark /><input disabled={!editable} data-field="total_employees" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.total_employees} onChange={(e) => set("total_employees", e.target.value)} /><FieldError show={hasMiss(missing, "total_employees")} message="필수" /></label>
        <label className="text-sm">전체 엔지니어 수 <RequiredMark /><input disabled={!editable} data-field="total_engineers" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.total_engineers} onChange={(e) => set("total_engineers", e.target.value)} /><FieldError show={hasMiss(missing, "total_engineers")} message="필수" /></label>
        <label className="text-sm">오케스트로 전담 영업인원 수 <RequiredMark /><input disabled={!editable} data-field="dedicated_sales_count" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.dedicated_sales_count} onChange={(e) => set("dedicated_sales_count", e.target.value)} /><FieldError show={hasMiss(missing, "dedicated_sales_count")} message="필수" /></label>
        <label className="text-sm">오케스트로 전담 기술인원 수<input disabled={!editable} className="mt-1 w-full rounded-lg border px-3 py-2" value={c.dedicated_technical_count} onChange={(e) => set("dedicated_technical_count", e.target.value)} /></label>
      </div>
    </div>
  );
}

function ContactStep({ form, updateForm, missing, editable }: StepProps) {
  const c = form.contact;
  const set = (key: keyof typeof c, value: string) =>
    updateForm((f) => ({ ...f, contact: { ...f.contact, [key]: value } }));
  return (
    <div>
      <h2 className="text-xl font-semibold">담당자 정보</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">성명 <RequiredMark /><input disabled={!editable} data-field="name" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.name} onChange={(e) => set("name", e.target.value)} /><FieldError show={hasMiss(missing, "name")} message="필수" /></label>
        <label className="text-sm">직급/직책 <RequiredMark /><input disabled={!editable} data-field="position" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.position} onChange={(e) => set("position", e.target.value)} /><FieldError show={hasMiss(missing, "position")} message="필수" /></label>
        <label className="text-sm">부서 <RequiredMark /><input disabled={!editable} data-field="department" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.department} onChange={(e) => set("department", e.target.value)} /><FieldError show={hasMiss(missing, "department")} message="필수" /></label>
        <label className="text-sm">직통번호<input disabled={!editable} className="mt-1 w-full rounded-lg border px-3 py-2" value={c.office_phone} onChange={(e) => set("office_phone", formatPhoneInput(e.target.value))} /></label>
        <label className="text-sm">휴대폰 <RequiredMark /><input disabled={!editable} data-field="phone" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.phone} onChange={(e) => set("phone", formatPhoneInput(e.target.value))} /><FieldError show={hasMiss(missing, "phone")} message="올바른 휴대폰 번호" /></label>
        <label className="text-sm">이메일 <RequiredMark /><input disabled={!editable} data-field="email" className="mt-1 w-full rounded-lg border px-3 py-2" value={c.email} onChange={(e) => set("email", e.target.value)} /><FieldError show={hasMiss(missing, "email")} message="올바른 이메일" /></label>
      </div>
    </div>
  );
}

function PeopleStep({ form, updateForm, missing, editable }: StepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">전담 인원</h2>
      <FieldError show={hasMiss(missing, "ceo")} message="대표이사 정보를 입력하세요." />
      <FieldError show={hasMiss(missing, "sales")} message="영업 전담인원 최소 1명이 필요합니다." />

      <div>
        <h3 className="font-medium">대표이사 <RequiredMark /></h3>
        {form.people.ceo.map((p, i) => (
          <div key={i} className="mt-2 grid gap-2 sm:grid-cols-3">
            <input disabled={!editable} data-field="ceo" placeholder="성명" className="rounded-lg border px-3 py-2 text-sm" value={p.name ?? ""} onChange={(e) => updateForm((f) => { const ceo = [...f.people.ceo]; ceo[i] = { ...ceo[i], name: e.target.value, section: "ceo" }; return { ...f, people: { ...f.people, ceo } }; })} />
            <input disabled={!editable} placeholder="직급" className="rounded-lg border px-3 py-2 text-sm" value={p.position ?? ""} onChange={(e) => updateForm((f) => { const ceo = [...f.people.ceo]; ceo[i] = { ...ceo[i], position: e.target.value }; return { ...f, people: { ...f.people, ceo } }; })} />
            <input disabled={!editable} placeholder="휴대폰" className="rounded-lg border px-3 py-2 text-sm" value={p.phone ?? ""} onChange={(e) => updateForm((f) => { const ceo = [...f.people.ceo]; ceo[i] = { ...ceo[i], phone: formatPhoneInput(e.target.value) }; return { ...f, people: { ...f.people, ceo } }; })} />
          </div>
        ))}
      </div>

      <RepeatPeople
        title="영업 전담인원"
        required
        editable={editable}
        rows={form.people.sales}
        onChange={(sales) => updateForm((f) => ({ ...f, people: { ...f.people, sales } }))}
        blank={{ section: "sales", duty: "영업", name: "", department: "", position: "", phone: "", email: "" }}
      />
      <RepeatPeople
        title="기술 전담인원"
        editable={editable}
        rows={form.people.engineer}
        onChange={(engineer) => updateForm((f) => ({ ...f, people: { ...f.people, engineer } }))}
        blank={{ section: "engineer", duty: "기술", name: "", department: "", position: "", phone: "", email: "", skill_level: "", main_skills: "" }}
        showSkills
      />
    </div>
  );
}

function RepeatPeople({
  title,
  required,
  rows,
  onChange,
  blank,
  editable,
  showSkills
}: {
  title: string;
  required?: boolean;
  rows: PartnerApplicationFormPayload["people"]["sales"];
  onChange: (rows: PartnerApplicationFormPayload["people"]["sales"]) => void;
  blank: PartnerApplicationFormPayload["people"]["sales"][number];
  editable: boolean;
  showSkills?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          {title} {required ? <RequiredMark /> : <span className="text-sm font-normal text-slate-500">(선택)</span>}
        </h3>
        {editable ? (
          <button type="button" className="text-sm text-blue-700" onClick={() => onChange([...rows, { ...blank }])}>
            + 추가
          </button>
        ) : null}
      </div>
      {rows.map((p, i) => (
        <div key={i} className="mt-2 grid gap-2 sm:grid-cols-3">
          <input disabled={!editable} data-field="sales" placeholder="성명" className="rounded-lg border px-3 py-2 text-sm" value={p.name ?? ""} onChange={(e) => { const next = [...rows]; next[i] = { ...next[i], name: e.target.value }; onChange(next); }} />
          <input disabled={!editable} placeholder="부서" className="rounded-lg border px-3 py-2 text-sm" value={p.department ?? ""} onChange={(e) => { const next = [...rows]; next[i] = { ...next[i], department: e.target.value }; onChange(next); }} />
          <input disabled={!editable} placeholder="직급" className="rounded-lg border px-3 py-2 text-sm" value={p.position ?? ""} onChange={(e) => { const next = [...rows]; next[i] = { ...next[i], position: e.target.value }; onChange(next); }} />
          <input disabled={!editable} placeholder="휴대폰" className="rounded-lg border px-3 py-2 text-sm" value={p.phone ?? ""} onChange={(e) => { const next = [...rows]; next[i] = { ...next[i], phone: formatPhoneInput(e.target.value) }; onChange(next); }} />
          <input disabled={!editable} placeholder="이메일" className="rounded-lg border px-3 py-2 text-sm" value={p.email ?? ""} onChange={(e) => { const next = [...rows]; next[i] = { ...next[i], email: e.target.value }; onChange(next); }} />
          {showSkills ? (
            <>
              <input disabled={!editable} placeholder="숙련도" className="rounded-lg border px-3 py-2 text-sm" value={p.skill_level ?? ""} onChange={(e) => { const next = [...rows]; next[i] = { ...next[i], skill_level: e.target.value }; onChange(next); }} />
              <input disabled={!editable} placeholder="주요기술" className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" value={p.main_skills ?? ""} onChange={(e) => { const next = [...rows]; next[i] = { ...next[i], main_skills: e.target.value }; onChange(next); }} />
            </>
          ) : null}
          {editable && rows.length > 1 ? (
            <button type="button" className="text-left text-xs text-red-600" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
              삭제
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CustomersStep({ form, updateForm, missing, editable }: StepProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          주요고객 및 영업계획 <RequiredMark />
        </h2>
        {editable ? (
          <button
            type="button"
            className="text-sm text-blue-700"
            onClick={() =>
              updateForm((f) => ({
                ...f,
                customers: [
                  ...f.customers,
                  { customer_name: "", proposal_status: "", business_timing: "", revenue_target: "" }
                ]
              }))
            }
          >
            + 추가
          </button>
        ) : null}
      </div>
      <FieldError show={hasMiss(missing, "min")} message="고객명 기준 최소 1건이 필요합니다. 제안 상황·사업 시기·매출 목표는 선택입니다." />
      {form.customers.map((row, i) => (
        <div key={i} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input disabled={!editable} data-field="min" placeholder="고객명 *" className="rounded-lg border px-3 py-2 text-sm" value={row.customer_name ?? ""} onChange={(e) => updateForm((f) => { const customers = [...f.customers]; customers[i] = { ...customers[i], customer_name: e.target.value }; return { ...f, customers }; })} />
          <input disabled={!editable} placeholder="제안 상황 (선택)" className="rounded-lg border px-3 py-2 text-sm" value={row.proposal_status ?? ""} onChange={(e) => updateForm((f) => { const customers = [...f.customers]; customers[i] = { ...customers[i], proposal_status: e.target.value }; return { ...f, customers }; })} />
          <input disabled={!editable} placeholder="사업 시기 (선택)" className="rounded-lg border px-3 py-2 text-sm" value={row.business_timing ?? ""} onChange={(e) => updateForm((f) => { const customers = [...f.customers]; customers[i] = { ...customers[i], business_timing: e.target.value }; return { ...f, customers }; })} />
          <input disabled={!editable} placeholder="매출 목표 (선택)" className="rounded-lg border px-3 py-2 text-sm" value={row.revenue_target ?? ""} onChange={(e) => updateForm((f) => { const customers = [...f.customers]; customers[i] = { ...customers[i], revenue_target: e.target.value }; return { ...f, customers }; })} />
          {editable && form.customers.length > 1 ? (
            <button type="button" className="text-left text-xs text-red-600" onClick={() => updateForm((f) => ({ ...f, customers: f.customers.filter((_, j) => j !== i) }))}>
              삭제
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EquipmentStep({ form, updateForm, missing, editable }: StepProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          장비현황 <span className="text-sm font-normal text-slate-500">(선택)</span>
        </h2>
        {editable ? (
          <button
            type="button"
            className="text-sm text-blue-700"
            onClick={() =>
              updateForm((f) => ({
                ...f,
                equipment: [...f.equipment, { equipment_name: "", model: "", quantity: "" }]
              }))
            }
          >
            + 추가
          </button>
        ) : null}
      </div>
      {form.equipment.length === 0 ? <p className="mt-2 text-sm text-slate-500">등록된 장비가 없습니다. 없어도 제출할 수 있습니다.</p> : null}
      {form.equipment.map((row, i) => (
        <div key={i} className="mt-2 grid gap-2 sm:grid-cols-4">
          <input disabled={!editable} placeholder="장비명" className="rounded-lg border px-3 py-2 text-sm" value={row.equipment_name ?? ""} onChange={(e) => updateForm((f) => { const equipment = [...f.equipment]; equipment[i] = { ...equipment[i], equipment_name: e.target.value }; return { ...f, equipment }; })} />
          <input disabled={!editable} placeholder="모델" className="rounded-lg border px-3 py-2 text-sm" value={row.model ?? ""} onChange={(e) => updateForm((f) => { const equipment = [...f.equipment]; equipment[i] = { ...equipment[i], model: e.target.value }; return { ...f, equipment }; })} />
          <input disabled={!editable} placeholder="수량" className="rounded-lg border px-3 py-2 text-sm" value={row.quantity ?? ""} onChange={(e) => updateForm((f) => { const equipment = [...f.equipment]; equipment[i] = { ...equipment[i], quantity: e.target.value }; return { ...f, equipment }; })} />
          {editable ? (
            <button type="button" className="text-left text-xs text-red-600" onClick={() => updateForm((f) => ({ ...f, equipment: f.equipment.filter((_, j) => j !== i) }))}>
              삭제
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function EngineersStep({ form, updateForm, missing, editable }: StepProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          기술인력 프로필 <span className="text-sm font-normal text-slate-500">(선택)</span>
        </h2>
        {editable ? (
          <button
            type="button"
            className="text-sm text-blue-700"
            onClick={() =>
              updateForm((f) => ({
                ...f,
                engineer_profiles: [
                  ...f.engineer_profiles,
                  { profile_sheet: 1, name: "", career_years: "", main_skills: "", certifications: "" }
                ]
              }))
            }
          >
            + 추가
          </button>
        ) : null}
      </div>
      {form.engineer_profiles.map((row, i) => (
        <div key={i} className="mt-2 grid gap-2 sm:grid-cols-2">
          <input disabled={!editable} placeholder="이름" className="rounded-lg border px-3 py-2 text-sm" value={row.name ?? ""} onChange={(e) => updateForm((f) => { const engineer_profiles = [...f.engineer_profiles]; engineer_profiles[i] = { ...engineer_profiles[i], name: e.target.value }; return { ...f, engineer_profiles }; })} />
          <input disabled={!editable} placeholder="경력(년)" className="rounded-lg border px-3 py-2 text-sm" value={row.career_years ?? ""} onChange={(e) => updateForm((f) => { const engineer_profiles = [...f.engineer_profiles]; engineer_profiles[i] = { ...engineer_profiles[i], career_years: e.target.value }; return { ...f, engineer_profiles }; })} />
          <input disabled={!editable} placeholder="주요기술" className="rounded-lg border px-3 py-2 text-sm" value={row.main_skills ?? ""} onChange={(e) => updateForm((f) => { const engineer_profiles = [...f.engineer_profiles]; engineer_profiles[i] = { ...engineer_profiles[i], main_skills: e.target.value }; return { ...f, engineer_profiles }; })} />
          <input disabled={!editable} placeholder="자격증" className="rounded-lg border px-3 py-2 text-sm" value={row.certifications ?? ""} onChange={(e) => updateForm((f) => { const engineer_profiles = [...f.engineer_profiles]; engineer_profiles[i] = { ...engineer_profiles[i], certifications: e.target.value }; return { ...f, engineer_profiles }; })} />
          {editable ? (
            <button type="button" className="text-left text-xs text-red-600" onClick={() => updateForm((f) => ({ ...f, engineer_profiles: f.engineer_profiles.filter((_, j) => j !== i) }))}>
              삭제
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
