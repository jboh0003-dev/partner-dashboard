"use client";

import Link from "next/link";
import JSZip from "jszip";
import {
  AlertTriangle,
  CheckCircle2,
  FileArchive,
  FolderOpen,
  FileCheck2,
  Loader2,
  UploadCloud
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { optimizePartnerUploadFile } from "@/lib/documents/optimize-upload-file";
import { classifyDocumentType } from "@/lib/documents/classify";
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  DOCUMENT_TYPE_LABEL,
  MAX_DOCUMENT_FILE_SIZE,
  PARTNER_DOCUMENTS_BUCKET,
  type DocumentType
} from "@/lib/documents/constants";
import { buildAutoDisplayName } from "@/lib/documents/display";
import {
  formatBusinessNumberDisplay,
  PARTNER_CONTRACT_GRADE_LABEL,
  type PartnerContractGrade
} from "@/lib/partner-application/contract-dates";
import { normalizeApplicationDate } from "@/lib/partner-application/normalize-application-date";
import type { ApplicationPerson } from "@/lib/partner-application/parse-application";

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
    similar: Array<{
      id: string;
      company_name: string;
      confidence: number;
      strategy: string;
      external_no?: string | null;
    }>;
    existing_partner: Record<string, unknown> | null;
  };
  numbering?: {
    max_used: number;
    suggested: string;
    existing: string | null;
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
  warnings?: string[];
};

type PackageDocument = {
  key: string;
  file: File;
  documentType: DocumentType;
  displayName: string;
  supported: boolean;
  skipReason: string | null;
};

type PackageResult = {
  partnerId: string;
  externalNo: string | null;
  partnerCreated: boolean;
  documentsSuccess: number;
  documentsReused: number;
  documentFailures: Array<{ name: string; message: string }>;
};

const REQUIRED_DOCUMENT_TYPES: DocumentType[] = [
  "company_profile",
  "business_registration",
  "bank_account",
  "credit_rating"
];

const UPDATE_FIELDS = [
  "company_name",
  "business_number",
  "ceo_name",
  "website",
  "founded_date",
  "credit_rating",
  "address",
  "revenue_2023",
  "employee_count",
  "engineer_count",
  "dedicated_sales_count",
  "dedicated_engineer_count"
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

function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function contentTypeFor(name: string): string {
  const ext = extensionOf(name);
  if (ext === "pdf") return "application/pdf";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  if (ext === "ppt") return "application/vnd.ms-powerpoint";
  if (ext === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  return "application/octet-stream";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

async function sha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function PartnerOnboardingPackageUploadSection() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [optimizedBytes, setOptimizedBytes] = useState(0);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [applicationFile, setApplicationFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<PackageDocument[]>([]);
  const [company, setCompany] = useState<CompanyForm>(emptyCompany());
  const [people, setPeople] = useState<ApplicationPerson[]>([]);
  const [grade, setGrade] = useState<PartnerContractGrade>("silver");
  const [contractStartDate, setContractStartDate] = useState("");
  const [externalNo, setExternalNo] = useState("");
  const [existingPartnerId, setExistingPartnerId] = useState<string | null>(null);
  const [existingPartnerName, setExistingPartnerName] = useState<string | null>(null);
  const [updateFields, setUpdateFields] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [duplicateHints, setDuplicateHints] = useState<AnalyzeResponse["duplicate_hints"]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PackageResult | null>(null);

  const activePeople = useMemo(() => people.filter((person) => !person.excluded), [people]);
  const contactCount = activePeople.filter((person) => person.section === "contract_contact").length;
  const salesCount = activePeople.filter((person) => person.section === "sales").length;
  const engineerCount = activePeople.filter((person) => person.section === "engineer").length;

  const missingRequired = useMemo(() => {
    const types = new Set(documents.filter((doc) => doc.supported).map((doc) => doc.documentType));
    return REQUIRED_DOCUMENT_TYPES.filter((type) => !types.has(type));
  }, [documents]);

  async function analyzePackage(file: File, selectedFiles?: File[]) {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setZipFile(file);

    try {
      let extracted: File[] = [];
      if (selectedFiles) {
        extracted = selectedFiles.filter((item) => !basename(item.name).startsWith("."));
      } else {
        if (!file.name.toLowerCase().endsWith(".zip")) {
          throw new Error("ZIP 또는 폴더를 선택해 주세요.");
        }
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter(
          (entry) => !entry.dir && !entry.name.startsWith("__MACOSX/") &&
            !basename(entry.name).startsWith(".")
        );
        if (entries.length > 40) throw new Error("한 번에 최대 40개 파일까지 처리할 수 있습니다.");
        extracted = await Promise.all(entries.map(async (entry) => {
          const name = basename(entry.name);
          const blob = await entry.async("blob");
          return new File([blob], name, { type: contentTypeFor(name), lastModified: Date.now() });
        }));
      }
      if (extracted.length === 0) throw new Error("선택한 폴더에 문서가 없습니다.");
      if (extracted.length > 40) throw new Error("한 번에 최대 40개 파일까지 처리할 수 있습니다.");
      const folderNames = new Set(selectedFiles?.map((f) => f.webkitRelativePath.split("/")[0]).filter(Boolean) ?? []);
      if (folderNames.size > 1) throw new Error("파트너사별 폴더 하나씩 선택해 주세요.");

      const application =
        extracted.find(
          (candidate) =>
            candidate.name.toLowerCase().endsWith(".xlsx") &&
            /파트너\s*신청서|파트너신청서|신청서/i.test(candidate.name)
        ) ??
        extracted.find((candidate) => candidate.name.toLowerCase().endsWith(".xlsx")) ??
        null;

      if (!application) {
        throw new Error("파트너 신청서 Excel(.xlsx)을 찾지 못했습니다.");
      }
      if (application.size > 4 * 1024 * 1024) {
        throw new Error("신청서 Excel은 4MB 이하 파일을 사용해 주세요.");
      }

      const nextDocs: PackageDocument[] = extracted
        .filter((candidate) => candidate !== application)
        .map((candidate, index) => {
          const ext = extensionOf(candidate.name);
          const documentType = classifyDocumentType(candidate.name);
          const supported = ALLOWED_DOCUMENT_EXTENSIONS.has(ext) && candidate.size <= MAX_DOCUMENT_FILE_SIZE;
          return {
            key: `${index}-${candidate.name}-${candidate.size}`,
            file: candidate,
            documentType,
            displayName: buildAutoDisplayName({
              document_type: documentType,
              original_filename: candidate.name
            }),
            supported,
            skipReason: !ALLOWED_DOCUMENT_EXTENSIONS.has(ext)
              ? `지원하지 않는 확장자 (.${ext || "-"})`
              : candidate.size > MAX_DOCUMENT_FILE_SIZE
                ? "50MB 초과"
                : null
          };
        });

      const form = new FormData();
      form.append("file", application);
      const response = await fetch("/api/partner-application/analyze", {
        method: "POST",
        body: form
      });
      const json = (await response.json()) as AnalyzeResponse;
      if (!response.ok || !json.parse) {
        throw new Error(json.message ?? "파트너 신청서 분석에 실패했습니다.");
      }

      const parsedCompany = json.parse.company;
      const founded =
        parsedCompany.founded_date ||
        normalizeApplicationDate(parsedCompany.founded_date_iso ?? null).display ||
        "";
      const applicationDate = normalizeApplicationDate(parsedCompany.application_date ?? null);

      setApplicationFile(application);
      setDocuments(nextDocs);
      setCompany({
        company_name_db: parsedCompany.company_name_db ?? parsedCompany.company_name_raw ?? "",
        company_name_contract:
          parsedCompany.company_name_contract ?? parsedCompany.company_name_raw ?? "",
        business_number: formatBusinessNumberDisplay(parsedCompany.business_number),
        ceo_name: parsedCompany.ceo_name ?? "",
        website: parsedCompany.website ?? "",
        founded_date: founded,
        credit_rating: parsedCompany.credit_rating ?? "",
        address: parsedCompany.address ?? "",
        revenue: parsedCompany.revenue ?? "",
        employee_count: parsedCompany.employee_count ?? "",
        engineer_count: parsedCompany.engineer_count ?? "",
        dedicated_sales_count: parsedCompany.dedicated_sales_count ?? "",
        dedicated_engineer_count: parsedCompany.dedicated_engineer_count ?? ""
      });
      setPeople([
        ...(json.parse.contract_contact ? [json.parse.contract_contact] : []),
        ...json.parse.sales_staff,
        ...json.parse.engineer_staff
      ]);
      setWarnings([...(json.parse.warnings ?? []), ...(json.parse.errors ?? [])]);
      setDuplicateHints(json.duplicate_hints ?? []);
      setExternalNo(json.numbering?.existing ?? json.numbering?.suggested ?? "");
      setExistingPartnerId(json.match?.exact?.id ?? null);
      setExistingPartnerName(json.match?.exact?.company_name ?? null);
      setUpdateFields(json.match?.exact ? UPDATE_FIELDS : []);
      setContractStartDate(
        applicationDate.iso ?? new Date().toISOString().slice(0, 10)
      );
    } catch (err) {
      setApplicationFile(null);
      setDocuments([]);
      setCompany(emptyCompany());
      setPeople([]);
      setExistingPartnerId(null);
      setExistingPartnerName(null);
      setError(err instanceof Error ? err.message : "패키지 분석에 실패했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function uploadPackageDocument(
    partnerId: string,
    document: PackageDocument,
    receivedDate: string | null
  ): Promise<"uploaded" | "reused"> {
    const optimized = await optimizePartnerUploadFile(document.file);
    const storedFile = optimized.file;
    const fileHash = await sha256(storedFile);
    const metadata = {
      document_type: document.documentType,
      display_name: document.displayName,
      original_filename: document.file.name,
      file_size: storedFile.size,
      file_hash: fileHash,
      content_type: storedFile.type || contentTypeFor(storedFile.name),
      received_date: receivedDate,
      note: "파트너 등록 패키지에서 자동 등록"
    };

    const prepareResponse = await fetch(
      `/api/partners/${partnerId}/documents/direct-upload/prepare`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata)
      }
    );
    const prepared = (await prepareResponse.json()) as
      | { ok: true; reused: true; document_id: string }
      | { ok: true; reused: false; path: string; token: string }
      | { ok: false; message: string };

    if (!prepareResponse.ok || !prepared.ok) {
      throw new Error("message" in prepared ? prepared.message : "업로드 준비 실패");
    }
    if (prepared.reused) return "reused";

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from(PARTNER_DOCUMENTS_BUCKET)
      .uploadToSignedUrl(prepared.path, prepared.token, storedFile, {
        contentType: metadata.content_type
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const finalizeResponse = await fetch(
      `/api/partners/${partnerId}/documents/direct-upload/finalize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...metadata, storage_path: prepared.path })
      }
    );
    const finalized = (await finalizeResponse.json()) as {
      ok: boolean;
      message?: string;
      reused?: boolean;
    };

    if (!finalizeResponse.ok || !finalized.ok) {
      throw new Error(finalized.message ?? "문서 DB 등록 실패");
    }
    if (!finalized.reused) setOptimizedBytes((current) => current + optimized.savedBytes);
    return finalized.reused ? "reused" : "uploaded";
  }

  async function handleRegister() {
    if (!applicationFile || registering) return;
    if (!/^\d+$/.test(externalNo.trim())) {
      setError("파트너 번호를 확인해 주세요.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(contractStartDate)) {
      setError("계약/등록 기준일을 확인해 주세요.");
      return;
    }

    setRegistering(true);
    setOptimizedBytes(0);
    setError(null);
    setResult(null);

    try {
      const registerForm = new FormData();
      registerForm.append("file", applicationFile);
      registerForm.append(
        "payload",
        JSON.stringify({
          company: {
            ...company,
            business_number: company.business_number || null,
            ceo_name: company.ceo_name || null,
            website: company.website || null,
            founded_date: company.founded_date || null,
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
          external_no: externalNo.trim(),
          people,
          existing_partner_id: existingPartnerId,
          update_fields: existingPartnerId ? updateFields : undefined
        })
      );

      const registerResponse = await fetch("/api/partner-application/register", {
        method: "POST",
        body: registerForm
      });
      const registered = (await registerResponse.json()) as RegisterResponse;

      if (!registerResponse.ok || !registered.ok || !registered.partner_id) {
        throw new Error(registered.message ?? "파트너 등록에 실패했습니다.");
      }

      let documentsSuccess = 0;
      let documentsReused = 0;
      const documentFailures: Array<{ name: string; message: string }> = [];

      for (const document of documents) {
        if (!document.supported) continue;
        try {
          const action = await uploadPackageDocument(
            registered.partner_id,
            document,
            contractStartDate
          );
          if (action === "reused") documentsReused += 1;
          else documentsSuccess += 1;
        } catch (err) {
          documentFailures.push({
            name: document.file.name,
            message: err instanceof Error ? err.message : "문서 등록 실패"
          });
        }
      }

      setResult({
        partnerId: registered.partner_id,
        externalNo: registered.external_no ?? null,
        partnerCreated: Boolean(registered.partner_created),
        documentsSuccess,
        documentsReused,
        documentFailures
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "파트너 패키지 등록에 실패했습니다.");
    } finally {
      setRegistering(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        className="cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-slate-400"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files?.[0];
          if (dropped) void analyzePackage(dropped);
        }}
      >
        <UploadCloud className="mx-auto text-slate-400" size={34} />
        <div className="mt-3 text-sm font-semibold text-slate-900">
          파트너 폴더 또는 메일 첨부 ZIP을 선택하세요
        </div>
        <div className="mt-1 text-xs text-slate-500">
          파트너 신청서 · 사업자등록증 · 통장사본 · 회사소개서 · 신용평가서를 자동 분류합니다.
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-semibold text-white"
            onClick={(event) => { event.stopPropagation(); folderInputRef.current?.click(); }}>
            <FolderOpen size={15} /> 폴더 선택
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }}>
            <FileArchive size={15} /> ZIP 선택
          </button>
        </div>
        <input ref={folderInputRef} type="file" multiple
          {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) void analyzePackage(files[0], files);
          }}
        />
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void analyzePackage(selected);
          }}
        />
        {zipFile ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-700">
            <FileArchive size={14} />
            {zipFile.name} · {formatBytes(zipFile.size)}
          </div>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">용량 최적화: JPEG·PDF·Office 문서에서 실제 용량이 줄어드는 경우에만 적용합니다. 저장 공간 안전 한도 900MB를 초과하면 업로드를 차단합니다.</p>
      {analyzing ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" />
          ZIP 해제 · 신청서 분석 · 문서 분류 중...
        </div>
      ) : null}

      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {applicationFile ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-950">
                  {company.company_name_db || "회사명 확인 필요"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  사업자등록번호 {company.business_number || "-"} · 대표자 {company.ceo_name || "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {company.address || "주소 미입력"}
                </div>
              </div>
              <div className="text-right text-xs text-slate-500">
                <div>신청서: {applicationFile.name}</div>
                <div className="mt-1">
                  담당 {contactCount} · 영업 {salesCount} · 기술 {engineerCount}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="매출액" value={company.revenue || "-"} />
              <Metric label="임직원" value={company.employee_count ? `${company.employee_count}명` : "-"} />
              <Metric label="엔지니어" value={company.engineer_count ? `${company.engineer_count}명` : "-"} />
              <Metric label="신용등급" value={company.credit_rating || "-"} />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-xs font-semibold text-slate-600">
                파트너 번호
                <input
                  value={externalNo}
                  onChange={(event) => setExternalNo(event.target.value.replace(/\D/g, ""))}
                  className="ui-input mt-1 w-full"
                />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                등급
                <select
                  value={grade}
                  onChange={(event) => setGrade(event.target.value as PartnerContractGrade)}
                  className="ui-select mt-1 w-full"
                >
                  {Object.entries(PARTNER_CONTRACT_GRADE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                계약/등록 기준일
                <input
                  type="date"
                  value={contractStartDate}
                  onChange={(event) => setContractStartDate(event.target.value)}
                  className="ui-input mt-1 w-full"
                />
              </label>
            </div>

            {existingPartnerId ? (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                기존 파트너 <span className="font-semibold">{existingPartnerName}</span>와 매칭되어
                신규 생성 대신 신청서 값으로 갱신합니다.
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">첨부 문서 자동 분류</div>
                <div className="mt-1 text-xs text-slate-500">
                  신청서는 파트너 등록 시 자동 저장되고, 나머지 문서는 파트너 문서함에 바로 등록됩니다.
                </div>
              </div>
              <div className="text-xs text-slate-500">
                저장 대상 {documents.filter((doc) => doc.supported).length}개
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">문서 구분</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">원본 파일</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500">크기</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((document) => (
                    <tr key={document.key}>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {DOCUMENT_TYPE_LABEL[document.documentType] ?? document.documentType}
                      </td>
                      <td className="max-w-[30rem] truncate px-3 py-2 text-slate-600" title={document.file.name}>
                        {document.file.name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                        {formatBytes(document.file.size)}
                      </td>
                      <td className="px-3 py-2">
                        {document.supported ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <FileCheck2 size={13} />
                            저장
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-rose-700">
                            제외 · {document.skipReason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missingRequired.length > 0 ? (
              <div className="mt-3 text-xs text-amber-700">
                미첨부 확인: {missingRequired.map((type) => DOCUMENT_TYPE_LABEL[type]).join(", ")}
              </div>
            ) : (
              <div className="mt-3 text-xs font-medium text-emerald-700">
                기본 제출서류가 모두 확인되었습니다.
              </div>
            )}
          </section>

          {warnings.length > 0 || (duplicateHints?.length ?? 0) > 0 ? (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <div className="font-semibold">등록 전 확인</div>
              {warnings.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
              {duplicateHints && duplicateHints.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {duplicateHints.map((hint, index) => (
                    <li key={`${hint.name}-${index}`}>
                      {hint.name}: {hint.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleRegister()}
              disabled={registering}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {registering ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {registering ? "파트너·인력·문서 등록 중..." : "한 번에 파트너 등록"}
            </button>
          </div>
        </>
      ) : null}

      {result ? (
        <section
          className={[
            "rounded-2xl border px-5 py-4",
            result.documentFailures.length > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          ].join(" ")}
        >
          <div className="text-sm font-semibold text-slate-950">
            {result.partnerCreated ? "신규 파트너 등록 완료" : "기존 파트너 갱신 완료"}
            {result.externalNo ? ` · ${result.externalNo}번` : ""}
          </div>
          <div className="mt-2 text-xs text-slate-700">
            문서 신규/교체 {result.documentsSuccess}건 · 기존 동일 문서 재사용 {result.documentsReused}건 · 압축 절감 {formatBytes(optimizedBytes)}
          </div>
          {result.documentFailures.length > 0 ? (
            <div className="mt-3 text-xs text-rose-800">
              <div className="font-semibold">문서 실패 {result.documentFailures.length}건</div>
              <ul className="mt-1 list-disc pl-5">
                {result.documentFailures.map((failure) => (
                  <li key={failure.name}>
                    {failure.name}: {failure.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Link
            href={`/dashboard/partners/${result.partnerId}`}
            className="mt-3 inline-flex text-xs font-semibold text-blue-700 hover:underline"
          >
            등록된 파트너 상세 보기
          </Link>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}
