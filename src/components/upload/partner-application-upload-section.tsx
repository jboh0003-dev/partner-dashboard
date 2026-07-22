"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  UploadCloud
} from "lucide-react";
import type { ApplicationPerson } from "@/lib/partner-application/parse-application";
import {
  computeContractEndDate,
  formatBusinessNumberDisplay,
  PARTNER_CONTRACT_GRADE_LABEL,
  type PartnerContractGrade
} from "@/lib/partner-application/contract-dates";
import { normalizePhoneInput } from "@/lib/contacts/phone-normalize";
import { normalizeApplicationDate } from "@/lib/partner-application/normalize-application-date";

type CompanyForm = {
  company_name_db: string;
  company_name_contract: string;
  business_number: string;
  ceo_name: string;
  website: string;
  founded_date: string;
  credit_rating: string;
  address: string;
  revenue: string;
  employee_count: string;
  engineer_count: string;
  dedicated_sales_count: string;
  dedicated_engineer_count: string;
};

type AnalyzeResponse = {
  ok: boolean;
  message?: string;
  file_name?: string;
  parse?: {
    ok: boolean;
    warnings: string[];
    errors: string[];
    company: Record<string, string | null>;
    contract_contact: ApplicationPerson | null;
    sales_staff: ApplicationPerson[];
    engineer_staff: ApplicationPerson[];
  };
  match?: {
    exact: { id: string; company_name: string; match: string } | null;
    similar: Array<{ id: string; company_name: string; confidence: number; strategy: string }>;
    existing_partner: Record<string, unknown> | null;
  };
  duplicate_hints?: Array<{ name: string; reason: string; sections: string[] }>;
};

type RegisterResponse = {
  ok: boolean;
  message?: string;
  partner_id?: string;
  partner_created?: boolean;
  external_no?: string | null;
  contacts_created?: number;
  contacts_updated?: number;
  document_id?: string | null;
  document_reused?: boolean;
  warnings?: string[];
};

const UPDATE_FIELD_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "company_name", label: "회사명" },
  { key: "business_number", label: "사업자등록번호" },
  { key: "ceo_name", label: "대표자" },
  { key: "website", label: "홈페이지" },
  { key: "founded_date", label: "설립일" },
  { key: "credit_rating", label: "신용등급" },
  { key: "address", label: "주소" },
  { key: "revenue_2023", label: "매출액" },
  { key: "employee_count", label: "임직원 수" },
  { key: "engineer_count", label: "엔지니어 수" }
];

function emptyCompany(): CompanyForm {
  return {
    company_name_db: "",
    company_name_contract: "",
    business_number: "",
    ceo_name: "",
    website: "",
    founded_date: "",
    credit_rating: "",
    address: "",
    revenue: "",
    employee_count: "",
    engineer_count: "",
    dedicated_sales_count: "",
    dedicated_engineer_count: ""
  };
}

function personKey(person: ApplicationPerson, index: number): string {
  return `${person.section}-${person.name}-${index}`;
}

function normalizePhoneDisplay(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return normalizePhoneInput(value)?.display_phone ?? value.trim();
}

function AccordionSection({
  title,
  summary,
  open,
  onToggle,
  children
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="mt-1 truncate text-xs text-slate-500">{summary}</div>
        </div>
        <ChevronDown
          size={18}
          className={["shrink-0 text-slate-400 transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>
      {open ? <div className="border-t border-slate-100 px-5 py-4">{children}</div> : null}
    </div>
  );
}

export function PartnerApplicationUploadSection() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [duplicateHints, setDuplicateHints] = useState<AnalyzeResponse["duplicate_hints"]>([]);
  const [company, setCompany] = useState<CompanyForm>(emptyCompany());
  const [people, setPeople] = useState<ApplicationPerson[]>([]);
  const [grade, setGrade] = useState<PartnerContractGrade>("silver");
  const [contractStartDate, setContractStartDate] = useState("");
  const [existingPartnerId, setExistingPartnerId] = useState<string | null>(null);
  const [similar, setSimilar] = useState<
    Array<{ id: string; company_name: string; confidence: number; strategy: string }>
  >([]);
  const [existingPartner, setExistingPartner] = useState<Record<string, unknown> | null>(null);
  const [updateFields, setUpdateFields] = useState<string[]>([]);
  const [registerResult, setRegisterResult] = useState<RegisterResponse | null>(null);
  const [analyzed, setAnalyzed] = useState(false);

  const [openCompany, setOpenCompany] = useState(true);
  const [openContract, setOpenContract] = useState(true);
  const [openPeople, setOpenPeople] = useState(false);
  const [openUpdateFields, setOpenUpdateFields] = useState(false);

  const contractEndDate = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(contractStartDate)) return "";
    try {
      return computeContractEndDate(contractStartDate);
    } catch {
      return "";
    }
  }, [contractStartDate]);

  const busy = analyzing || registering || downloading;

  const companySummary = [
    company.company_name_db || "회사명 미입력",
    company.business_number ? `사업자등록번호 ${company.business_number}` : null,
    company.ceo_name ? `대표자 ${company.ceo_name}` : null
  ]
    .filter(Boolean)
    .join(" · ");

  const contractSummary = [
    PARTNER_CONTRACT_GRADE_LABEL[grade],
    contractStartDate && contractEndDate
      ? `${contractStartDate} ~ ${contractEndDate}`
      : "계약일 미입력"
  ].join(" · ");

  const peopleSummary = useMemo(() => {
    const active = people.filter((p) => !p.excluded);
    const contract = active.filter((p) => p.section === "contract_contact").length;
    const sales = active.filter((p) => p.section === "sales").length;
    const engineer = active.filter((p) => p.section === "engineer").length;
    return `계약담당 ${contract}명 · 영업 ${sales}명 · 기술 ${engineer}명`;
  }, [people]);

  async function analyzeSelectedFile(nextFile: File) {
    setAnalyzing(true);
    setError(null);
    setRegisterResult(null);
    setAnalyzed(false);
    try {
      const form = new FormData();
      form.append("file", nextFile);
      const res = await fetch("/api/partner-application/analyze", {
        method: "POST",
        body: form
      });
      const json = (await res.json()) as AnalyzeResponse;
      if (!res.ok || !json.parse) {
        throw new Error(json.message ?? "신청서 분석에 실패했습니다.");
      }

      const c = json.parse.company;
      const foundedDisplay =
        c.founded_date ||
        normalizeApplicationDate(c.founded_date_iso ?? c.founded_date).display ||
        "";

      setCompany({
        company_name_db: c.company_name_db ?? c.company_name_raw ?? "",
        company_name_contract: c.company_name_contract ?? c.company_name_raw ?? "",
        business_number: formatBusinessNumberDisplay(c.business_number),
        ceo_name: c.ceo_name ?? "",
        website: c.website ?? "",
        founded_date: foundedDisplay,
        credit_rating: c.credit_rating ?? "",
        address: c.address ?? "",
        revenue: c.revenue ?? "",
        employee_count: c.employee_count ?? "",
        engineer_count: c.engineer_count ?? "",
        dedicated_sales_count: c.dedicated_sales_count ?? "",
        dedicated_engineer_count: c.dedicated_engineer_count ?? ""
      });

      const nextPeople: ApplicationPerson[] = [
        ...(json.parse.contract_contact ? [json.parse.contract_contact] : []),
        ...json.parse.sales_staff,
        ...json.parse.engineer_staff
      ].map((p) => ({
        ...p,
        phone: normalizePhoneDisplay(p.phone),
        excluded: false
      }));
      setPeople(nextPeople);
      setWarnings([...(json.parse.warnings ?? []), ...(json.parse.errors ?? [])]);
      setDuplicateHints(json.duplicate_hints ?? []);
      setExistingPartnerId(json.match?.exact?.id ?? null);
      setSimilar(json.match?.similar ?? []);
      setExistingPartner(json.match?.existing_partner ?? null);
      setUpdateFields(
        json.match?.exact
          ? UPDATE_FIELD_OPTIONS.map((f) => f.key).filter((key) => {
              const map: Record<string, string | null | undefined> = {
                company_name: c.company_name_db,
                business_number: c.business_number,
                ceo_name: c.ceo_name,
                website: c.website,
                founded_date: c.founded_date,
                credit_rating: c.credit_rating,
                address: c.address,
                revenue_2023: c.revenue,
                employee_count: c.employee_count,
                engineer_count: c.engineer_count
              };
              return Boolean(map[key]?.toString().trim());
            })
          : []
      );
      setOpenCompany(true);
      setOpenContract(true);
      setOpenPeople(false);
      setOpenUpdateFields(false);
      setAnalyzed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 실패");
      setAnalyzed(false);
    } finally {
      setAnalyzing(false);
    }
  }

  function onFileChange(next: File | null) {
    if (!next) return;
    if (!next.name.toLowerCase().endsWith(".xlsx")) {
      setError("Excel(.xlsx) 파일만 업로드할 수 있습니다.");
      return;
    }
    setFile(next);
    void analyzeSelectedFile(next);
  }

  function updatePerson(index: number, patch: Partial<ApplicationPerson>) {
    setPeople((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleRegister() {
    if (!file || busy) return;
    if (!contractStartDate) {
      setError("계약일을 입력해 주세요.");
      return;
    }
    const founded = normalizeApplicationDate(company.founded_date);
    if (company.founded_date.trim() && !founded.ok) {
      setError(
        "설립일자 형식을 확인해주세요. 월까지만 입력된 경우 자동으로 해당 월 1일 기준으로 저장됩니다."
      );
      return;
    }

    setRegistering(true);
    setError(null);
    try {
      const normalizedPeople = people.map((p) => ({
        ...p,
        phone: normalizePhoneDisplay(p.phone) || null
      }));
      const form = new FormData();
      form.append("file", file);
      form.append(
        "payload",
        JSON.stringify({
          company: {
            ...company,
            founded_date: company.founded_date || null,
            business_number: company.business_number || null,
            ceo_name: company.ceo_name || null,
            website: company.website || null,
            credit_rating: company.credit_rating || null,
            address: company.address || null,
            revenue: company.revenue || null,
            employee_count: company.employee_count || null,
            engineer_count: company.engineer_count || null,
            dedicated_sales_count: company.dedicated_sales_count || null,
            dedicated_engineer_count: company.dedicated_engineer_count || null
          },
          grade,
          contract_start_date: contractStartDate,
          people: normalizedPeople,
          existing_partner_id: existingPartnerId,
          update_fields: existingPartnerId ? updateFields : undefined
        })
      );
      const res = await fetch("/api/partner-application/register", {
        method: "POST",
        body: form
      });
      const json = (await res.json()) as RegisterResponse;
      if (!res.ok || !json.ok) {
        throw new Error(json.message ?? "등록 실패");
      }
      setRegisterResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록 실패");
    } finally {
      setRegistering(false);
    }
  }

  async function handleContractDownload() {
    if (busy) return;
    if (!company.company_name_contract.trim()) {
      setError("계약서 표기 회사명이 필요합니다.");
      return;
    }
    if (!company.ceo_name.trim() || !company.business_number.trim() || !contractStartDate) {
      setError("대표자, 사업자등록번호, 계약일을 확인해 주세요.");
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/partner-application/contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade,
          company_name_contract: company.company_name_contract,
          ceo_name: company.ceo_name,
          business_number: company.business_number,
          contract_start_date: contractStartDate
        })
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(json?.message ?? "계약서 생성 실패");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
      const filename = decodeURIComponent(match?.[1] || match?.[2] || "partner-contract.docx");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "계약서 다운로드 실패");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="mb-6 space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">파트너 신청서 등록</div>
            <div className="mt-1 text-sm text-slate-500">
              파트너 신청서를 분석하여 회사·담당자·전담인원을 등록하고 계약서를 생성합니다.
            </div>
            <div className="mt-2 text-xs text-slate-400">
              지원: .xlsx · 계약서는 브라우저 다운로드만 (Storage 미저장)
            </div>
          </div>
          <FileSpreadsheet className="text-slate-400" size={20} />
        </div>

        <div
          className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) onFileChange(dropped);
          }}
        >
          <UploadCloud className="text-slate-400" size={28} />
          <div className="mt-3 text-sm font-medium text-slate-700">
            신청서 파일을 선택하거나 끌어다 놓으세요
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {file ? file.name : "0. 파트너 신청서 / 1. 전담 인원 시트 필요"}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {analyzing ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          신청서 분석 중…
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {analyzed ? (
        <>
          {warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="font-semibold">검토 필요</div>
              <ul className="mt-1 list-disc pl-5">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {duplicateHints && duplicateHints.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-700">
              <div className="font-semibold text-amber-800">중복 가능성</div>
              <ul className="mt-2 space-y-1">
                {duplicateHints.map((hint, i) => (
                  <li key={`${hint.name}-${i}`}>
                    {hint.name} — {hint.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {existingPartnerId || similar.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setOpenUpdateFields((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">기존 파트너 업데이트 항목</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {existingPartnerId
                      ? `매칭됨${existingPartner?.company_name ? ` · ${String(existingPartner.company_name)}` : ""} · 업데이트 ${updateFields.length}개 필드`
                      : `유사 후보 ${similar.length}건 · 자동 병합하지 않음`}
                  </div>
                </div>
                <ChevronDown
                  size={18}
                  className={["text-slate-400 transition", openUpdateFields ? "rotate-180" : ""].join(
                    " "
                  )}
                />
              </button>
              {openUpdateFields ? (
                <div className="space-y-3 border-t border-slate-100 px-5 py-4 text-sm">
                  {existingPartnerId ? (
                    <div className="flex flex-wrap gap-3">
                      {UPDATE_FIELD_OPTIONS.map((field) => (
                        <label key={field.key} className="inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={updateFields.includes(field.key)}
                            onChange={(e) => {
                              setUpdateFields((prev) =>
                                e.target.checked
                                  ? [...prev, field.key]
                                  : prev.filter((k) => k !== field.key)
                              );
                            }}
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {similar.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center gap-2">
                          <span>
                            {item.company_name} ({item.strategy}, {item.confidence}%)
                          </span>
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                            onClick={() => {
                              setExistingPartnerId(item.id);
                              setOpenUpdateFields(true);
                            }}
                          >
                            이 파트너로 연결
                          </button>
                        </li>
                      ))}
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => setExistingPartnerId(null)}
                      >
                        신규 회사로 등록
                      </button>
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <AccordionSection
            title="회사정보"
            summary={companySummary}
            open={openCompany}
            onToggle={() => setOpenCompany((v) => !v)}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ["company_name_db", "DB 표시 회사명"],
                  ["company_name_contract", "계약서 표기 회사명"],
                  ["ceo_name", "대표자명"],
                  ["business_number", "사업자등록번호"],
                  ["website", "홈페이지"],
                  ["founded_date", "설립일자"],
                  ["address", "주소"],
                  ["credit_rating", "신용등급"],
                  ["revenue", "매출액"],
                  ["employee_count", "임직원 수"],
                  ["engineer_count", "엔지니어 수"],
                  ["dedicated_sales_count", "전담 영업인원 수"],
                  ["dedicated_engineer_count", "전담 기술인원 수"]
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs text-slate-600">
                  {label}
                  {key === "founded_date" ? (
                    <span className="ml-1 text-[11px] text-slate-400">
                      (저장 시 YYYY-MM-DD로 변환)
                    </span>
                  ) : null}
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    value={company[key]}
                    onChange={(e) =>
                      setCompany((prev) => ({
                        ...prev,
                        [key]:
                          key === "business_number"
                            ? formatBusinessNumberDisplay(e.target.value)
                            : e.target.value
                      }))
                    }
                    onBlur={() => {
                      if (key !== "founded_date") return;
                      const normalized = normalizeApplicationDate(company.founded_date);
                      if (normalized.ok && normalized.display) {
                        setCompany((prev) => ({ ...prev, founded_date: normalized.display ?? "" }));
                      }
                    }}
                  />
                </label>
              ))}
            </div>
          </AccordionSection>

          <AccordionSection
            title="계약정보"
            summary={contractSummary}
            open={openContract}
            onToggle={() => setOpenContract((v) => !v)}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-xs text-slate-600">
                계약등급
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value as PartnerContractGrade)}
                >
                  {(Object.keys(PARTNER_CONTRACT_GRADE_LABEL) as PartnerContractGrade[]).map(
                    (key) => (
                      <option key={key} value={key}>
                        {PARTNER_CONTRACT_GRADE_LABEL[key]}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className="block text-xs text-slate-600">
                계약일 (필수)
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                />
              </label>
              <label className="block text-xs text-slate-600">
                계약 종료일 (자동)
                <input
                  type="date"
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  value={contractEndDate}
                />
              </label>
            </div>
          </AccordionSection>

          <AccordionSection
            title="담당자 / 전담인원"
            summary={peopleSummary}
            open={openPeople}
            onToggle={() => setOpenPeople((v) => !v)}
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-2">구분</th>
                    <th className="px-2 py-2">이름</th>
                    <th className="px-2 py-2">부서</th>
                    <th className="px-2 py-2">직급</th>
                    <th className="px-2 py-2">휴대폰</th>
                    <th className="px-2 py-2">이메일</th>
                    <th className="px-2 py-2">제외</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person, index) => (
                    <tr
                      key={personKey(person, index)}
                      className={person.excluded ? "bg-slate-50 opacity-60" : ""}
                    >
                      <td className="px-2 py-2 text-xs text-slate-500">
                        {person.section === "contract_contact"
                          ? "계약담당"
                          : person.section === "sales"
                            ? "영업"
                            : "기술"}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-28 rounded border border-slate-200 px-2 py-1"
                          value={person.name}
                          onChange={(e) => updatePerson(index, { name: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-28 rounded border border-slate-200 px-2 py-1"
                          value={person.department ?? ""}
                          onChange={(e) => updatePerson(index, { department: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-24 rounded border border-slate-200 px-2 py-1"
                          value={person.position ?? ""}
                          onChange={(e) => updatePerson(index, { position: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-36 rounded border border-slate-200 px-2 py-1"
                          value={person.phone ?? ""}
                          onChange={(e) => updatePerson(index, { phone: e.target.value })}
                          onBlur={(e) =>
                            updatePerson(index, {
                              phone: normalizePhoneDisplay(e.target.value) || null
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          className="w-44 rounded border border-slate-200 px-2 py-1"
                          value={person.email ?? ""}
                          onChange={(e) => updatePerson(index, { email: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(person.excluded)}
                          onChange={(e) => updatePerson(index, { excluded: e.target.checked })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionSection>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleRegister()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {registering ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              파트너 등록 및 신청서 저장
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleContractDownload()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:opacity-60"
            >
              {downloading ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              Word 계약서 다운로드
            </button>
          </div>

          {registerResult?.ok ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              등록 완료
              {registerResult.partner_created ? " (신규 파트너)" : " (기존 파트너 갱신)"}
              {registerResult.external_no ? ` · 파트너번호 ${registerResult.external_no}` : ""}
              {` · 담당자 생성 ${registerResult.contacts_created ?? 0} / 갱신 ${registerResult.contacts_updated ?? 0}`}
              {registerResult.document_reused
                ? " · 신청서 문서는 동일 해시로 재사용"
                : " · 신청서 원본 저장됨"}
              {registerResult.partner_id ? (
                <div className="mt-2">
                  <Link
                    className="underline"
                    href={`/dashboard/partners/${registerResult.partner_id}`}
                  >
                    파트너 상세 보기
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
