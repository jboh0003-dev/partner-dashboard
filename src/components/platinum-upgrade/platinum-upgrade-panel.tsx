"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  Search,
  Sparkles
} from "lucide-react";

type SearchHit = {
  id: string;
  company_name: string;
  legal_company_name: string;
  legal_company_name_source_label?: string;
  business_number: string | null;
  ceo_name: string | null;
  grade: string;
  grade_label: string;
  is_platinum: boolean;
  partner_no: string;
};

type GeneratedFile = {
  filename: string;
  base64: string;
  content_type: string;
  document_id: string;
};

function downloadBase64(filename: string, base64: string, contentType: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearGeneratedState(setters: {
  setDocx: (v: GeneratedFile | null) => void;
  setPdf: (v: GeneratedFile | null) => void;
  setResultMessage: (v: string | null) => void;
  setResultError: (v: string | null) => void;
}) {
  setters.setDocx(null);
  setters.setPdf(null);
  setters.setResultMessage(null);
  setters.setResultError(null);
}

export function PlatinumUpgradePanel() {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [legalCompanyName, setLegalCompanyName] = useState("");
  const [nameSourceLabel, setNameSourceLabel] = useState<string | null>(null);
  const [agreementDate, setAgreementDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [docx, setDocx] = useState<GeneratedFile | null>(null);
  const [pdf, setPdf] = useState<GeneratedFile | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setSearchError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(
          `/api/platinum-upgrade/search?q=${encodeURIComponent(q)}&limit=15`
        );
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setSearchError(json.message ?? "검색에 실패했습니다.");
          setHits([]);
          return;
        }
        setHits(json.partners ?? []);
      } catch {
        setSearchError("검색 중 오류가 발생했습니다.");
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function selectPartner(hit: SearchHit) {
    setSelected(hit);
    setQuery(hit.company_name);
    setLegalCompanyName(hit.legal_company_name || hit.company_name);
    setNameSourceLabel(hit.legal_company_name_source_label ?? null);
    setHits([]);
    clearGeneratedState({ setDocx, setPdf, setResultMessage, setResultError });

    // 선택 시 서버에서 정식 상호를 재조회 (계약서 우선 + 신청서 fallback)
    try {
      const res = await fetch(
        `/api/platinum-upgrade/search?partnerId=${encodeURIComponent(hit.id)}`
      );
      const json = await res.json();
      if (res.ok && json.ok && json.partner) {
        const partner = json.partner as SearchHit;
        setSelected(partner);
        setLegalCompanyName(partner.legal_company_name || partner.company_name);
        setNameSourceLabel(partner.legal_company_name_source_label ?? null);
      }
    } catch {
      // 검색 결과 값 유지
    }
  }

  async function runGenerate() {
    if (!selected) {
      setResultError("파트너를 먼저 검색·선택해 주세요.");
      return;
    }
    if (!legalCompanyName.trim()) {
      setResultError("상호(정식 법인명)를 입력해 주세요.");
      return;
    }
    if (!agreementDate) {
      setResultError("문서 마지막 계약일을 입력해 주세요.");
      return;
    }

    setGenerating(true);
    setResultError(null);
    setResultMessage(null);
    setDocx(null);
    setPdf(null);

    try {
      const res = await fetch("/api/platinum-upgrade/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: selected.id,
          agreement_date: agreementDate,
          company_name: legalCompanyName.trim()
        })
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setResultError(json.message ?? "문서 생성에 실패했습니다.");
        return;
      }

      setDocx(json.docx);
      setPdf(json.pdf);
      setResultMessage(json.message);
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              grade: "platinum",
              grade_label: "Platinum",
              is_platinum: true
            }
          : prev
      );
    } catch {
      setResultError("문서 생성 중 오류가 발생했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  const hasGenerated = Boolean(docx || pdf);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">1. 파트너 검색</h2>
        <p className="mt-1 text-xs text-slate-500">
          회사명 또는 사업자등록번호로 검색한 뒤 선택합니다.
        </p>

        <div className="relative mt-3">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setLegalCompanyName("");
              setNameSourceLabel(null);
              clearGeneratedState({ setDocx, setPdf, setResultMessage, setResultError });
            }}
            placeholder="회사명 또는 사업자등록번호"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-okestro-200 focus:ring-2"
          />
          {searching ? (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
            />
          ) : null}
        </div>

        {searchError ? (
          <p className="mt-2 text-sm text-rose-600">{searchError}</p>
        ) : null}

        {hits.length > 0 && !selected ? (
          <ul className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  onClick={() => void selectPartner(hit)}
                  className="flex w-full flex-col gap-0.5 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50"
                >
                  <span className="text-sm font-medium text-slate-900">{hit.company_name}</span>
                  <span className="text-xs text-slate-500">
                    {hit.partner_no}
                    {hit.business_number ? ` · ${hit.business_number}` : ""}
                    {` · ${hit.grade_label}`}
                    {hit.is_platinum ? " (Platinum)" : ""}
                  </span>
                  {hit.legal_company_name && hit.legal_company_name !== hit.company_name ? (
                    <span className="text-xs text-slate-500">
                      정식 상호: {hit.legal_company_name}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">2. 자동 입력 정보</h2>
        <p className="mt-1 text-xs text-slate-500">
          상호는 DB 회사명 철자에 기존 계약서의 법인 표기(주식회사/(주) 등)만 결합합니다. 필요 시 직접 수정할 수 있습니다.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
              상호
            </span>
            <input
              value={legalCompanyName}
              onChange={(e) => {
                setLegalCompanyName(e.target.value);
                setNameSourceLabel("직접 입력");
                clearGeneratedState({ setDocx, setPdf, setResultMessage, setResultError });
              }}
              disabled={!selected}
              placeholder="주식회사 예시 / 예시(주)"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none ring-okestro-200 focus:ring-2 disabled:bg-slate-50"
            />
            {selected && nameSourceLabel ? (
              <span className="mt-1 block text-2xs text-slate-500">출처: {nameSourceLabel}</span>
            ) : null}
            {selected?.company_name ? (
              <span className="mt-0.5 block text-2xs text-slate-400">
                DB 표시명: {selected.company_name}
              </span>
            ) : null}
          </label>
          <Field label="사업자등록번호" value={selected?.business_number ?? ""} />
          <Field label="대표이사" value={selected?.ceo_name ?? ""} />
        </div>

        {selected?.is_platinum ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">이미 Platinum 등급인 파트너입니다.</p>
              <p className="mt-0.5 text-xs text-amber-800">
                문서는 다시 생성할 수 있으며, 등급은 변경되지 않습니다.
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">3. 문서 마지막 계약일</h2>
        <input
          type="date"
          value={agreementDate}
          onChange={(e) => {
            setAgreementDate(e.target.value);
            clearGeneratedState({ setDocx, setPdf, setResultMessage, setResultError });
          }}
          className="mt-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-okestro-200 focus:ring-2"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">4. 문서 생성</h2>
        <p className="mt-1 text-xs text-slate-500">
          플래티넘 파트너 부속합의서 DOCX/PDF를 생성합니다. Silver 이하는 생성 성공 후 Platinum으로
          승급하고, 이미 Platinum이면 등급을 유지합니다.
        </p>

        <div className="mt-4">
          <button
            type="button"
            disabled={generating || !selected}
            onClick={() => void runGenerate()}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            부속합의서 생성
          </button>
        </div>

        {resultError ? (
          <p className="mt-3 text-sm text-rose-600">{resultError}</p>
        ) : null}

        {hasGenerated ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            {resultMessage ? (
              <p className="mb-3 flex items-start gap-2 text-sm text-emerald-800">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                {resultMessage}
              </p>
            ) : null}
            <p className="mb-3 text-xs font-medium text-slate-600">생성 결과</p>
            <div className="flex flex-wrap gap-2">
              {pdf?.document_id ? (
                <button
                  type="button"
                  onClick={() => {
                    window.open(
                      `/api/partners/documents/${pdf.document_id}/preview`,
                      "_blank",
                      "noopener,noreferrer"
                    );
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Eye size={16} />
                  미리보기
                </button>
              ) : null}
              {docx ? (
                <button
                  type="button"
                  onClick={() => downloadBase64(docx.filename, docx.base64, docx.content_type)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Download size={16} />
                  Word 다운로드
                </button>
              ) : null}
              {pdf ? (
                <button
                  type="button"
                  onClick={() => downloadBase64(pdf.filename, pdf.base64, pdf.content_type)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Download size={16} />
                  PDF 다운로드
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <input
        readOnly
        value={value || "-"}
        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
      />
    </label>
  );
}
