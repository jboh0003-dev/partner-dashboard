"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2, UploadCloud } from "lucide-react";
import { PartnerSearchCombobox } from "@/components/upload/partner-search-combobox";
import { parsePartnerDocumentFile } from "@/lib/documents/parse-metadata";
import {
  buildPartnerSearchOptions,
  findPartnerOptionById,
  type PartnerSearchOption
} from "@/lib/documents/partner-search";
import {
  applyDocumentTypeChange,
  applyFolderBulkPartner,
  applyManualPartnerSelection,
  applyRecommendedPartner,
  getFolderGroupKey,
  resolveSaveAction,
  type PartnerDocumentAnalysisItem,
  type PartnerDocumentAnalysisSummary
} from "@/lib/imports/partner-documents";
import {
  computeUploadReviewStats,
  filterUploadReviewItems,
  getUploadRowStatusLabel,
  getUploadRowStatusTone,
  UPLOAD_DOCUMENT_TYPE_LABEL,
  UPLOAD_DOCUMENT_TYPES,
  type UploadReviewFilter
} from "@/lib/imports/partner-documents-ui";

type PartnerOption = { id: string; company_name: string; external_no?: string | null };

type SaveSummary = {
  total: number;
  storage_success: number;
  db_success: number;
  success: number;
  created: number;
  updated: number;
  skipped: number;
  needs_review: number;
  failed: number;
};

type SaveFailure = { row_number: number; filename: string; message: string };

const FILTER_OPTIONS: Array<{ value: UploadReviewFilter; label: string }> = [
  { value: "all", label: "전체" },
  { value: "saveable", label: "저장 예정" },
  { value: "needs_review", label: "확인 필요" },
  { value: "matched", label: "매칭 완료" },
  { value: "no_partner", label: "파트너 미선택" }
];

export function PartnerDocumentsUploadSection() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileMapRef = useRef<Map<number, File>>(new Map());

  const [batchLabel, setBatchLabel] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ReturnType<typeof parsePartnerDocumentFile>[]>([]);
  const [partnerOptions, setPartnerOptions] = useState<PartnerOption[]>([]);
  const [editableItems, setEditableItems] = useState<PartnerDocumentAnalysisItem[]>([]);
  const [preview, setPreview] = useState<{
    summary: PartnerDocumentAnalysisSummary;
    loading: boolean;
    error: string | null;
  }>({
    summary: emptySummary(),
    loading: false,
    error: null
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(null);
  const [saveFailures, setSaveFailures] = useState<SaveFailure[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [folderPartnerDraft, setFolderPartnerDraft] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<UploadReviewFilter>("needs_review");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(true);
  const [saveableOnly, setSaveableOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const searchablePartners = useMemo(
    () => buildPartnerSearchOptions(partnerOptions),
    [partnerOptions]
  );

  const reviewStats = useMemo(() => computeUploadReviewStats(editableItems), [editableItems]);

  const filteredItems = useMemo(
    () =>
      filterUploadReviewItems(editableItems, {
        statusFilter,
        needsReviewOnly,
        saveableOnly,
        query: searchQuery
      }),
    [editableItems, statusFilter, needsReviewOnly, saveableOnly, searchQuery]
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<string, PartnerDocumentAnalysisItem[]>();
    for (const item of filteredItems) {
      const key = getFolderGroupKey(item);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  useEffect(() => {
    if (parsedRows.length === 0) {
      setEditableItems([]);
      setPartnerOptions([]);
      setPreview({ summary: emptySummary(), loading: false, error: null });
      return;
    }

    let cancelled = false;
    setPreview((prev) => ({ ...prev, loading: true, error: null }));

    void (async () => {
      try {
        const response = await fetch("/api/import/partners/documents/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: parsedRows })
        });
        const json = await response.json();
        if (cancelled) return;
        if (!response.ok || !json.ok) {
          throw new Error(json?.message ?? "문서 미리보기에 실패했습니다.");
        }
        setEditableItems(json.items as PartnerDocumentAnalysisItem[]);
        setPartnerOptions((json.partners as PartnerOption[]) ?? []);
        setPreview({
          summary: json.summary as PartnerDocumentAnalysisSummary,
          loading: false,
          error: null
        });
      } catch (error) {
        if (cancelled) return;
        setEditableItems([]);
        setPreview({
          summary: {
            ...emptySummary(),
            total: parsedRows.length,
            skipped: parsedRows.length
          },
          loading: false,
          error: error instanceof Error ? error.message : "문서 미리보기에 실패했습니다."
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [parsedRows]);

  const canSave = useMemo(
    () => editableItems.some((item) => resolveSaveAction(item) != null) && !preview.loading && !isSaving,
    [editableItems, preview.loading, isSaving]
  );

  function updateItem(rowNumber: number, patch: Partial<PartnerDocumentAnalysisItem>) {
    setEditableItems((items) =>
      items.map((item) => (item.row_number === rowNumber ? { ...item, ...patch } : item))
    );
  }

  function handlePartnerChange(rowNumber: number, partner: PartnerSearchOption | null) {
    setEditableItems((items) =>
      items.map((item) => {
        if (item.row_number !== rowNumber) return item;
        return applyManualPartnerSelection(
          item,
          partner ? { id: partner.id, company_name: partner.company_name } : null
        );
      })
    );
  }

  function handleRecommendedApply(rowNumber: number) {
    setEditableItems((items) =>
      items.map((item) => {
        if (item.row_number !== rowNumber || !item.suggested_partner_id) return item;
        return applyRecommendedPartner(item, {
          id: item.suggested_partner_id,
          company_name: item.suggested_partner_name ?? ""
        });
      })
    );
  }

  function handleDocumentTypeChange(
    rowNumber: number,
    documentType: PartnerDocumentAnalysisItem["document_type"]
  ) {
    setEditableItems((items) =>
      items.map((item) =>
        item.row_number === rowNumber ? applyDocumentTypeChange(item, documentType) : item
      )
    );
  }

  function handleFolderBulkApply(folderKey: string, partnerId?: string) {
    const selectedId = partnerId ?? folderPartnerDraft[folderKey];
    const partner = partnerOptions.find((row) => row.id === selectedId) ?? null;
    if (!partner) return;
    setEditableItems((items) => applyFolderBulkPartner(items, folderKey, partner));
  }

  function handleFolderRecommendedApply(folderKey: string, items: PartnerDocumentAnalysisItem[]) {
    const suggestion = getFolderSuggestedPartner(items);
    if (!suggestion) return;
    setFolderPartnerDraft((prev) => ({ ...prev, [folderKey]: suggestion.id }));
    handleFolderBulkApply(folderKey, suggestion.id);
  }

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((file) => !file.name.startsWith("."));
    if (files.length === 0) return;

    fileMapRef.current.clear();
    const rows = files.map((file, index) => {
      const rowNumber = index + 1;
      fileMapRef.current.set(rowNumber, file);
      return parsePartnerDocumentFile(file, rowNumber);
    });

    setBatchLabel(files[0]?.webkitRelativePath?.split("/")[0] ?? `${files.length}개 파일`);
    setParsedRows(rows);
    setSaveSummary(null);
    setSaveFailures([]);
    setSaveError(null);
    setStatusFilter("needs_review");
    setNeedsReviewOnly(true);
    setSaveableOnly(false);
    setSearchQuery("");
  }

  async function handleSave() {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSummary(null);
      setSaveFailures([]);

      const formData = new FormData();
      formData.append("batch_name", batchLabel ?? "partner-documents-upload");
      formData.append("metadata", JSON.stringify(editableItems));

      for (const item of editableItems) {
        if (!resolveSaveAction(item)) continue;
        const file = fileMapRef.current.get(item.row_number);
        if (!file) continue;
        formData.append(`file_${item.row_number}`, file);
      }

      const response = await fetch("/api/import/partners/documents", {
        method: "POST",
        body: formData
      });
      const json = await response.json();
      if (Array.isArray(json.failures)) {
        setSaveFailures(json.failures);
      }
      if (json.summary) {
        setSaveSummary(json.summary as SaveSummary);
      }
      if (!response.ok || !json.ok) {
        throw new Error(json?.message ?? "문서 저장에 실패했습니다.");
      }

      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "문서 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <UploadCloud className="mx-auto mb-3 text-slate-400" size={36} />
        <p className="text-sm font-semibold text-slate-900">
          ZIP은 미리 압축 해제한 뒤 폴더 또는 여러 파일을 선택하세요.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          폴더명을 우선으로 파트너를 추정합니다. 파일명을 바꾸지 않아도 검색·추천·일괄 적용으로
          검수할 수 있습니다.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            <FolderOpen size={16} />
            폴더 선택
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={(event) => handleFilesSelected(event.target.files)}
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
            파일 선택
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(event) => handleFilesSelected(event.target.files)}
            />
          </label>
        </div>
        {batchLabel ? (
          <p className="mt-4 text-xs text-slate-500">
            선택됨: <span className="font-semibold text-slate-700">{batchLabel}</span> ·{" "}
            {parsedRows.length}개 파일
          </p>
        ) : null}
      </div>

      {parsedRows.length > 0 ? (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <SummaryCard label="전체 파일" value={reviewStats.total || parsedRows.length} />
            <SummaryCard label="저장 예정" value={reviewStats.saveable} tone="emerald" />
            <SummaryCard label="확인 필요" value={reviewStats.needsReview} tone="amber" />
            <SummaryCard label="파트너 미선택" value={reviewStats.noPartner} tone="rose" />
            <SummaryCard label="문서유형 미확인" value={reviewStats.docTypeUncertain} tone="amber" />
          </section>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    statusFilter === option.value
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={needsReviewOnly}
                  onChange={(event) => setNeedsReviewOnly(event.target.checked)}
                />
                확인 필요만 보기
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={saveableOnly}
                  onChange={(event) => setSaveableOnly(event.target.checked)}
                />
                저장 예정만 보기
              </label>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="폴더명, 파일명, 파트너명 검색"
                className="min-w-[240px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              표시 중{" "}
              <span className="font-semibold text-slate-700">
                {filteredItems.length.toLocaleString("ko-KR")}
              </span>
              / {editableItems.length.toLocaleString("ko-KR")}건
            </p>
          </div>

          {preview.loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              파트너 매칭 및 우선순위를 계산하는 중입니다...
            </div>
          ) : null}

          {preview.error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {preview.error}
            </div>
          ) : null}

          {groupedItems.length === 0 && !preview.loading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              현재 필터 조건에 맞는 검수 대상이 없습니다.
            </div>
          ) : (
            <div className="space-y-6">
              {groupedItems.map(([folderKey, items]) => {
                const isGenericFolder = items.some((item) => item.is_generic_folder);
                const folderDisplayName = getFolderDisplayName(items, folderKey);
                const folderSuggestion = isGenericFolder
                  ? null
                  : getFolderSuggestedPartner(items);
                return (
                  <div
                    key={folderKey}
                    className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{folderDisplayName}</p>
                          {folderDisplayName !== folderKey ? (
                            <p className="mt-0.5 text-xs text-slate-400">원본 폴더: {folderKey}</p>
                          ) : null}
                          <p className="mt-1 text-xs text-slate-500">{items.length}개 파일</p>
                          {isGenericFolder ? (
                            <p className="mt-2 text-xs text-amber-700">
                              월별/공유 폴더 — 파일명 기준으로 파트너를 확인하세요.
                            </p>
                          ) : folderSuggestion ? (
                            <p className="mt-2 text-xs text-blue-700">
                              추천:{" "}
                              <span className="font-semibold">{folderSuggestion.name}</span>
                              {folderSuggestion.confidence > 0
                                ? ` (${folderSuggestion.confidence}%)`
                                : null}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {!isGenericFolder && folderSuggestion ? (
                            <button
                              type="button"
                              onClick={() => handleFolderRecommendedApply(folderKey, items)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                            >
                              추천 적용
                            </button>
                          ) : null}
                          {!isGenericFolder ? (
                            <>
                              <PartnerSearchCombobox
                                options={searchablePartners}
                                value={folderPartnerDraft[folderKey] ?? ""}
                                onChange={(partner) =>
                                  setFolderPartnerDraft((prev) => ({
                                    ...prev,
                                    [folderKey]: partner?.id ?? ""
                                  }))
                                }
                                placeholder="폴더 파트너 검색..."
                                className="min-w-[16rem]"
                              />
                              <button
                                type="button"
                                disabled={!folderPartnerDraft[folderKey] && !folderSuggestion}
                                onClick={() => handleFolderBulkApply(folderKey)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-50"
                              >
                                이 폴더 전체에 적용
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <table className="min-w-[1700px] w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50/80">
                        <tr>
                          {[
                            "폴더 / 출처",
                            "매칭 파트너",
                            "문서유형",
                            "표시 파일명",
                            "원본 파일명",
                            "저장",
                            "상태",
                            "사유"
                          ].map((label) => (
                            <th
                              key={label}
                              className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item) => (
                          <DocumentRow
                            key={item.client_key}
                            item={item}
                            searchablePartners={searchablePartners}
                            onPartnerChange={handlePartnerChange}
                            onRecommendedApply={handleRecommendedApply}
                            onDocumentTypeChange={handleDocumentTypeChange}
                            onUpdateItem={updateItem}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {saveSummary ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">저장 결과</p>
              <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                <li>전체 파일: {saveSummary.total}</li>
                <li>Storage 저장 성공: {saveSummary.storage_success}</li>
                <li>DB 저장 성공: {saveSummary.db_success}</li>
                <li>신규: {saveSummary.created}</li>
                <li>업데이트: {saveSummary.updated}</li>
                <li>스킵: {saveSummary.skipped}</li>
                <li>확인 필요: {saveSummary.needs_review}</li>
                <li>실패: {saveSummary.failed}</li>
              </ul>
            </div>
          ) : null}

          {saveFailures.length > 0 ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <p className="font-semibold">실패 파일</p>
              <ul className="mt-2 space-y-1 text-xs">
                {saveFailures.map((failure) => (
                  <li key={`${failure.row_number}-${failure.filename}`}>
                    {failure.filename}: {failure.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            {saveError ? <p className="text-sm text-rose-600">{saveError}</p> : null}
            <button
              type="button"
              disabled={!canSave}
              onClick={() => void handleSave()}
              className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving ? "저장 중..." : "문서 저장"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function DocumentRow({
  item,
  searchablePartners,
  onPartnerChange,
  onRecommendedApply,
  onDocumentTypeChange,
  onUpdateItem
}: {
  item: PartnerDocumentAnalysisItem;
  searchablePartners: PartnerSearchOption[];
  onPartnerChange: (rowNumber: number, partner: PartnerSearchOption | null) => void;
  onRecommendedApply: (rowNumber: number) => void;
  onDocumentTypeChange: (
    rowNumber: number,
    documentType: PartnerDocumentAnalysisItem["document_type"]
  ) => void;
  onUpdateItem: (rowNumber: number, patch: Partial<PartnerDocumentAnalysisItem>) => void;
}) {
  const folderLabel = item.source_folder_name ?? item.partner_name_raw ?? "-";
  const statusLabel = getUploadRowStatusLabel(item);
  const statusTone = getUploadRowStatusTone(item);
  const showRecommendation =
    item.suggested_partner_id &&
    item.suggested_partner_id !== item.matched_partner_id &&
    item.review_status !== "skipped";

  const toneClass =
    statusTone === "emerald"
      ? "bg-emerald-100 text-emerald-800"
      : statusTone === "rose"
        ? "bg-rose-100 text-rose-800"
        : statusTone === "amber"
          ? "bg-amber-100 text-amber-800"
          : statusTone === "blue"
            ? "bg-blue-100 text-blue-800"
            : "bg-slate-100 text-slate-700";

  return (
    <tr className={item.review_status === "skipped" ? "bg-slate-50/80" : "hover:bg-slate-50"}>
      <td className="max-w-[10rem] px-3 py-2 text-xs text-slate-600">
        <div className="break-words font-medium text-slate-800">{folderLabel}</div>
        {item.partner_name_source ? (
          <div className="mt-0.5 text-[10px] text-slate-400">
            출처: {item.partner_name_source === "folder" ? "폴더" : "파일명"}
          </div>
        ) : null}
      </td>
      <td className="min-w-[18rem] px-3 py-2">
        <div className="space-y-2">
          {showRecommendation ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5">
              <span className="text-[11px] text-blue-800">
                추천: <span className="font-semibold">{item.suggested_partner_name}</span>
              </span>
              <button
                type="button"
                onClick={() => onRecommendedApply(item.row_number)}
                className="rounded-md border border-blue-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100"
              >
                추천 적용
              </button>
            </div>
          ) : null}
          <PartnerSearchCombobox
            options={searchablePartners}
            value={item.matched_partner_id}
            onChange={(partner) => onPartnerChange(item.row_number, partner)}
            disabled={item.review_status === "skipped"}
            placeholder="파트너명 검색..."
          />
        </div>
      </td>
      <td className="min-w-[8rem] px-3 py-2">
        <select
          value={item.document_type}
          onChange={(event) =>
            onDocumentTypeChange(
              item.row_number,
              event.target.value as PartnerDocumentAnalysisItem["document_type"]
            )
          }
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        >
          {UPLOAD_DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {UPLOAD_DOCUMENT_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </td>
      <td className="min-w-[12rem] px-3 py-2">
        <input
          value={item.display_name}
          onChange={(event) => onUpdateItem(item.row_number, { display_name: event.target.value })}
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
      </td>
      <td
        className="max-w-[14rem] px-3 py-2 text-xs text-slate-600"
        title={item.original_filename}
      >
        <span className="break-words">{item.original_filename}</span>
      </td>
      <td className="px-3 py-2 text-center">
        <div className="space-y-2">
          <input
            type="checkbox"
            checked={item.save_enabled}
            disabled={item.review_status === "skipped"}
            onChange={(event) =>
              onUpdateItem(item.row_number, { save_enabled: event.target.checked })
            }
          />
          {item.already_registered ? (
            <label className="flex items-center justify-center gap-1 text-[10px] text-amber-700">
              <input
                type="checkbox"
                checked={item.save_as_new_version}
                onChange={(event) =>
                  onUpdateItem(item.row_number, {
                    save_as_new_version: event.target.checked,
                    save_enabled: event.target.checked
                  })
                }
              />
              새 버전
            </label>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
          {statusLabel}
        </span>
      </td>
      <td className="max-w-[14rem] px-3 py-2 text-xs text-slate-500">
        <span className="break-words">{item.reason}</span>
      </td>
    </tr>
  );
}

function getFolderDisplayName(
  items: PartnerDocumentAnalysisItem[],
  folderKey: string
): string {
  const sample = items[0];
  if (!sample?.is_generic_folder && sample?.folder_normalized_name) {
    return sample.folder_normalized_name;
  }
  return folderKey;
}

function getFolderSuggestedPartner(items: PartnerDocumentAnalysisItem[]) {
  if (items.some((item) => item.is_generic_folder)) return null;

  const first = items[0];
  if (first?.folder_normalized_name && first.folder_match_candidates.length > 0) {
    const folderMatch = items.find(
      (item) =>
        item.suggested_partner_id &&
        item.folder_normalized_name === first.folder_normalized_name
    );
    if (folderMatch?.suggested_partner_id && folderMatch.suggested_partner_name) {
      return {
        id: folderMatch.suggested_partner_id,
        name: folderMatch.suggested_partner_name,
        confidence: folderMatch.suggested_partner_confidence
      };
    }
  }

  const counts = new Map<string, { id: string; name: string; confidence: number; count: number }>();

  for (const item of items) {
    if (!item.suggested_partner_id || !item.suggested_partner_name) continue;
    const current = counts.get(item.suggested_partner_id) ?? {
      id: item.suggested_partner_id,
      name: item.suggested_partner_name,
      confidence: item.suggested_partner_confidence,
      count: 0
    };
    current.count += 1;
    counts.set(item.suggested_partner_id, current);
  }

  const sorted = Array.from(counts.values()).sort((left, right) => right.count - left.count);
  const top = sorted[0];
  return top ? { id: top.id, name: top.name, confidence: top.confidence } : null;
}

function emptySummary(): PartnerDocumentAnalysisSummary {
  return {
    total: 0,
    saveable: 0,
    skipped: 0,
    review: 0,
    by_type: {},
    create: 0,
    update: 0
  };
}

function SummaryCard({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "rose"
          ? "text-rose-700"
          : "text-slate-950";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>
        {value.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}
