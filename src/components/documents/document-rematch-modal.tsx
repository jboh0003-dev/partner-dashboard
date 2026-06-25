"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import { savePartnerDocumentRematch } from "@/app/dashboard/documents/actions";
import { PartnerSearchCombobox } from "@/components/upload/partner-search-combobox";
import {
  getDocumentDisplayFileName,
  getDocumentTypeShortLabel,
  getMatchStatusLabel,
  resolveMatchStatus
} from "@/lib/documents/display";
import {
  getDocumentReviewReason,
  REMATCH_DOCUMENT_TYPE_OPTIONS
} from "@/lib/documents/rematch";
import {
  buildPartnerSearchOptions,
  type PartnerSearchOption
} from "@/lib/documents/partner-search";
import { formatDate } from "@/lib/utils";
import type { DocumentListRow } from "@/components/documents/documents-list-table";

type DocumentRematchModalProps = {
  document: DocumentListRow | null;
  partnerOptions: Array<{ id: string; company_name: string; external_no?: string | null }>;
  onClose: () => void;
  onSaved: () => void;
};

function toDocumentSource(row: DocumentListRow) {
  return {
    document_type: row.document_type,
    display_name: row.display_name,
    file_name: row.file_name,
    original_filename: row.original_filename,
    file_ext: row.file_ext
  };
}

export function DocumentRematchModal({
  document,
  partnerOptions,
  onClose,
  onSaved
}: DocumentRematchModalProps) {
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contractDate, setContractDate] = useState("");
  const [grade, setGrade] = useState("");
  const [note, setNote] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const documentTypeOptions = useMemo(() => {
    if (!document?.document_type) return REMATCH_DOCUMENT_TYPE_OPTIONS;
    const current = document.document_type;
    if (REMATCH_DOCUMENT_TYPE_OPTIONS.some((option) => option.value === current)) {
      return REMATCH_DOCUMENT_TYPE_OPTIONS;
    }
    return [
      {
        value: current,
        label: getDocumentTypeShortLabel(current)
      },
      ...REMATCH_DOCUMENT_TYPE_OPTIONS
    ];
  }, [document?.document_type]);

  const searchOptions = useMemo(
    () => buildPartnerSearchOptions(partnerOptions),
    [partnerOptions]
  );

  useEffect(() => {
    if (!document) return;

    const normalizedType = document.document_type ?? "";
    setPartnerId(document.partner_id);
    setDocumentType(normalizedType);
    setDisplayName(
      document.display_name?.trim() ||
        getDocumentDisplayFileName(toDocumentSource(document))
    );
    setContractDate(document.contract_date?.slice(0, 10) ?? "");
    setGrade(document.grade_from_file ?? "");
    setNote(document.note ?? "");
    setErrorMessage(null);
  }, [document]);

  useEffect(() => {
    if (!document) return;

    const previousOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = "hidden";
    return () => {
      window.document.body.style.overflow = previousOverflow;
    };
  }, [document]);

  if (!document) return null;

  const status = resolveMatchStatus({
    match_status: document.match_status,
    review_status: document.review_status
  });

  function handlePartnerChange(option: PartnerSearchOption | null) {
    setPartnerId(option?.id ?? null);
    setErrorMessage(null);
  }

  function handleSave() {
    if (!document) return;
    if (!partnerId) {
      setErrorMessage("파트너사를 선택해 주세요.");
      return;
    }
    if (!documentType.trim()) {
      setErrorMessage("문서 구분을 선택해 주세요.");
      return;
    }

    const currentDocument = document;
    setErrorMessage(null);
    startTransition(async () => {
      const result = await savePartnerDocumentRematch({
        documentId: currentDocument.id,
        partnerId,
        documentType: documentType.trim(),
        displayName: displayName.trim() || null,
        contractDate: contractDate.trim() || null,
        grade: grade.trim() || null,
        note: note.trim() || null
      });

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      onSaved();
      onClose();
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label="문서 재매칭 닫기"
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-rematch-title"
        className="fixed inset-x-4 top-[8vh] z-50 mx-auto flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="document-rematch-title" className="text-lg font-bold text-slate-950">
              문서 재매칭
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              파트너사·문서 구분 등 메타데이터만 수정합니다. 파일은 변경되지 않습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <section className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              현재 정보
            </h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">현재 파트너사</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{document.partner_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">원본 파일명</dt>
                <dd className="mt-0.5 break-all font-medium text-slate-900">
                  {document.original_filename ?? document.file_name}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">현재 문서 구분</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {getDocumentTypeShortLabel(document.document_type)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">현재 표시 파일명</dt>
                <dd className="mt-0.5 break-all font-medium text-slate-900">
                  {getDocumentDisplayFileName(toDocumentSource(document))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">현재 계약일자</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {document.contract_date ? formatDate(document.contract_date) : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">현재 상태</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {getMatchStatusLabel(status)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">확인 필요 사유</dt>
                <dd className="mt-0.5 text-amber-800">{getDocumentReviewReason(document)}</dd>
              </div>
            </dl>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              수정 항목
            </h3>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">파트너사</span>
              <PartnerSearchCombobox
                options={searchOptions}
                value={partnerId}
                onChange={handlePartnerChange}
                placeholder="파트너명 검색..."
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">문서 구분</span>
              <select
                value={documentType}
                onChange={(event) => {
                  setDocumentType(event.target.value);
                  setErrorMessage(null);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              >
                <option value="">문서 구분 선택</option>
                {documentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">표시 파일명</span>
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">계약일자</span>
                <input
                  type="date"
                  value={contractDate}
                  onChange={(event) => setContractDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">등급</span>
                <input
                  type="text"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  placeholder="예: A, B, C"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">비고 / 메모</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
              />
            </label>
          </section>

          {errorMessage ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
        </footer>
      </div>
    </>
  );
}
