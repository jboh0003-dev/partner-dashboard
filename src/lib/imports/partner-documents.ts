import {
  extractPartnerNameFromFolderPath,
  computeDocumentPriorityScore
} from "@/lib/documents/parse-metadata";
import {
  buildDocumentStoragePath,
  coerceSafeStoragePath,
  isSafeStorageObjectKey
} from "@/lib/documents/storage-path";
import type { ParsedPartnerDocumentFile } from "@/lib/documents/parse-metadata";
import type {
  DocumentMatchMethod,
  DocumentMatchSource,
  DocumentMatchStatus,
  DocumentReviewStatus
} from "@/lib/documents/constants";
import {
  isAllowedDocumentExtension,
  MAX_DOCUMENT_FILE_SIZE
} from "@/lib/documents/constants";
import { isDocumentTypeConfident } from "@/lib/documents/classify";
import { buildAutoDisplayName } from "@/lib/documents/display";
import { matchDocumentPartner, type DocumentMatchResult } from "@/lib/documents/document-matching";
import { findPartnerNamesMentionedInFilename } from "@/lib/documents/filename-parser";
import {
  findRegistrationDuplicate,
  isMultiDocumentAllowed,
  isVisibleDocument,
  normalizeOriginalFilename
} from "@/lib/documents/duplicate-detection";

export type PartnerDocumentPartnerRow = {
  id: string;
  company_name: string;
  external_no: string | null;
};

export type PartnerDocumentDbRow = {
  id: string;
  partner_id: string;
  document_type: string | null;
  original_filename: string | null;
  file_name: string;
  file_size?: number | null;
  storage_path?: string | null;
  file_path?: string | null;
  is_active?: boolean | null;
  is_duplicate?: boolean | null;
  created_at?: string | null;
};

export type PartnerDocumentAnalysisItem = ParsedPartnerDocumentFile & {
  extracted_partner_name: string | null;
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  match_source: DocumentMatchSource | null;
  match_status: DocumentMatchStatus;
  match_method: DocumentMatchMethod | null;
  match_confidence: number;
  review_status: DocumentReviewStatus;
  save_enabled: boolean;
  action: "create" | "update" | "skip" | "review";
  reason: string;
  is_primary: boolean;
  priority_score: number;
  matched_document_id: string | null;
  suggested_partner_id: string | null;
  suggested_partner_name: string | null;
  suggested_partner_confidence: number;
  partner_edit_source: "auto" | "manual" | "folder_bulk" | "suggested" | null;
  already_registered: boolean;
  save_as_new_version: boolean;
};

export type PartnerDocumentAnalysisSummary = {
  total: number;
  saveable: number;
  skipped: number;
  review: number;
  by_type: Record<string, number>;
  create: number;
  update: number;
};

export function analyzePartnerDocumentRows(
  rows: ParsedPartnerDocumentFile[],
  partners: PartnerDocumentPartnerRow[],
  existingDocuments: PartnerDocumentDbRow[]
): { items: PartnerDocumentAnalysisItem[]; summary: PartnerDocumentAnalysisSummary } {
  const existingMap = buildExistingMap(existingDocuments);
  const canonicalTypeMap = buildCanonicalTypeMap(existingDocuments);
  const batchKeys = new Set<string>();

  const items: PartnerDocumentAnalysisItem[] = rows.map((row) => {
    const validation = validateUploadRow(row);
    if (validation) return validation;

    const mentionedInFilename = findPartnerNamesMentionedInFilename(
      row.original_filename,
      partners
    );

    const match = matchDocumentPartner({
      folderCandidates: row.is_generic_folder ? [] : row.folder_match_candidates,
      folderNormalizedName: row.folder_normalized_name,
      isGenericFolder: row.is_generic_folder,
      filenamePartnerName: row.filename_partner_name,
      filenameCandidates: [...row.filename_partner_candidates, ...mentionedInFilename],
      sourceFolderName: row.source_folder_name,
      partnerNo: row.partner_no,
      partners
    });

    const suggestion = resolveSuggestedPartner(row, match, partners);

    const extractedName =
      row.folder_normalized_name ??
      row.folder_match_candidates[0] ??
      row.filename_partner_name ??
      row.partner_name_raw;
    const docTypeConfident = isDocumentTypeConfident(row.original_filename, row.document_type);

    let reason = match.reason;

    if (match.match_status === "matched" && !docTypeConfident) {
      reason = `${match.reason} / 문서 구분 확인 권장 (기타)`;
    }

    if (match.match_status === "needs_review" && !docTypeConfident && !reason.includes("문서 구분")) {
      reason = `${reason} / 문서 구분 확인 필요`;
    }

    if (match.match_status === "unmatched" || !match.partner) {
      return withSuggestionFields(
        buildAnalysisItem(row, extractedName, {
          partner: null,
          action: "review",
          reason,
          match_source: mapMethodToSource(match.match_method),
          match_status: match.match_status,
          match_method: match.match_method,
          match_confidence: match.match_confidence,
          review_status: "needs_review",
          save_enabled: false,
          matched_document_id: null,
          is_primary: false
        }),
        suggestion
      );
    }

    if (match.match_status === "needs_review") {
      return withSuggestionFields(
        buildAnalysisItem(row, extractedName, {
          partner: match.partner,
          action: "review",
          reason,
          match_source: mapMethodToSource(match.match_method),
          match_status: "needs_review",
          match_method: match.match_method,
          match_confidence: match.match_confidence,
          review_status: "needs_review",
          save_enabled: false,
          matched_document_id: null,
          is_primary: false
        }),
        suggestion
      );
    }

    const batchKey = `${match.partner.id}:${row.document_type}:${row.original_filename}:${row.file_size}`;
    if (batchKeys.has(batchKey)) {
      return skipItem(
        row,
        extractedName,
        "스킵 / 사유: 업로드 배치 내 중복 파일",
        match.partner,
        mapMethodToSource(match.match_method),
        match.match_method,
        match.match_confidence
      );
    }

    const registeredDuplicate = findRegistrationDuplicate(
      existingDocuments.map((doc) => ({
        id: doc.id,
        partner_id: doc.partner_id,
        document_type: doc.document_type,
        original_filename: doc.original_filename,
        display_name: doc.file_name,
        file_size: doc.file_size ?? null,
        created_at: "",
        is_active: doc.is_active,
        is_duplicate: doc.is_duplicate
      })),
      {
        partner_id: match.partner.id,
        document_type: row.document_type,
        original_filename: row.original_filename,
        file_size: row.file_size
      }
    );

    if (registeredDuplicate) {
      batchKeys.add(batchKey);
      return skipItem(
        row,
        extractedName,
        "스킵 / 사유: 동일 파일이 이미 등록되어 있습니다.",
        match.partner,
        mapMethodToSource(match.match_method),
        match.match_method,
        match.match_confidence
      );
    }

    const allowsMultiple = isMultiDocumentAllowed({
      document_type: row.document_type,
      original_filename: row.original_filename,
      display_name: row.display_name
    });
    const canonical = !allowsMultiple
      ? canonicalTypeMap.get(`${match.partner.id}:${row.document_type}`)
      : null;

    const legacyBatchKey = `${match.partner.id}:${row.document_type}:${row.original_filename}`;
    if (batchKeys.has(legacyBatchKey)) {
      return skipItem(
        row,
        extractedName,
        "스킵 / 사유: 중복 파일",
        match.partner,
        mapMethodToSource(match.match_method),
        match.match_method,
        match.match_confidence
      );
    }
    batchKeys.add(batchKey);
    batchKeys.add(legacyBatchKey);

    const filenameExisting = existingMap.get(legacyBatchKey);
    const existing = canonical ?? filenameExisting;

    return withSuggestionFields(
      buildAnalysisItem(row, extractedName, {
        partner: match.partner,
        action: existing ? "update" : "create",
        reason: existing ? "기존 문서를 최신본으로 교체합니다." : reason,
        match_source: mapMethodToSource(match.match_method),
        match_status: "matched",
        match_method: match.match_method,
        match_confidence: match.match_confidence,
        review_status: "auto_matched",
        save_enabled: true,
        matched_document_id: existing?.id ?? null,
        is_primary: true
      }),
      suggestion,
      "auto"
    );
  });

  applyPrimaryFlags(items);

  const saveableItems = items.filter((item) => resolveSaveAction(item) != null);
  const byType: Record<string, number> = {};
  for (const item of saveableItems) {
    byType[item.document_type] = (byType[item.document_type] ?? 0) + 1;
  }

  return {
    items,
    summary: {
      total: items.length,
      saveable: saveableItems.length,
      skipped: items.filter((item) => item.review_status === "skipped").length,
      review: items.filter(
        (item) =>
          item.match_status === "needs_review" || item.match_status === "unmatched"
      ).length,
      by_type: byType,
      create: saveableItems.filter((item) => item.action === "create").length,
      update: saveableItems.filter((item) => item.action === "update").length
    }
  };
}

function mapMethodToSource(method: DocumentMatchMethod | null): DocumentMatchSource | null {
  if (!method) return null;
  if (method === "manual") return "manual";
  if (method === "folder") return "folder";
  if (method === "fuzzy") return "fuzzy";
  if (method === "exact" || method === "alias") return "filename";
  return "folder";
}

function validateUploadRow(row: ParsedPartnerDocumentFile): PartnerDocumentAnalysisItem | null {
  if (!isAllowedDocumentExtension(row.file_ext)) {
    return skipItem(
      row,
      row.partner_name_raw,
      `스킵 / 지원하지 않는 확장자 (.${row.file_ext || "없음"})`,
      null,
      null,
      null,
      0
    );
  }

  if (row.file_size > MAX_DOCUMENT_FILE_SIZE) {
    return skipItem(row, row.partner_name_raw, "스킵 / 파일 크기 50MB 초과", null, null, null, 0);
  }

  return null;
}

function resolveSuggestedPartner(
  row: ParsedPartnerDocumentFile,
  match: DocumentMatchResult,
  partners: PartnerDocumentPartnerRow[]
): { id: string; name: string; confidence: number } | null {
  if (match.match_status === "matched" && match.partner && match.save_enabled) {
    return null;
  }

  if (!row.is_generic_folder && row.folder_match_candidates.length > 0) {
    const folderMatch = matchDocumentPartner({
      folderCandidates: row.folder_match_candidates,
      folderNormalizedName: row.folder_normalized_name,
      isGenericFolder: false,
      filenameCandidates: [],
      sourceFolderName: row.source_folder_name,
      partners
    });
    if (folderMatch.partner && folderMatch.save_enabled) {
      return {
        id: folderMatch.partner.id,
        name: folderMatch.partner.company_name,
        confidence: folderMatch.match_confidence
      };
    }
  }

  if (match.partner && match.match_confidence >= 60) {
    return {
      id: match.partner.id,
      name: match.partner.company_name,
      confidence: match.match_confidence
    };
  }

  if (match.candidates.length === 1 && match.match_confidence >= 60) {
    const candidate = match.candidates[0]!;
    return {
      id: candidate.id,
      name: candidate.company_name,
      confidence: match.match_confidence
    };
  }

  return null;
}

function withSuggestionFields(
  item: PartnerDocumentAnalysisItem,
  suggestion: { id: string; name: string; confidence: number } | null,
  editSource: PartnerDocumentAnalysisItem["partner_edit_source"] = null
): PartnerDocumentAnalysisItem {
  return {
    ...item,
    suggested_partner_id: suggestion?.id ?? null,
    suggested_partner_name: suggestion?.name ?? null,
    suggested_partner_confidence: suggestion?.confidence ?? 0,
    partner_edit_source: editSource ?? item.partner_edit_source ?? (item.save_enabled ? "auto" : null)
  };
}

function buildAnalysisItem(
  row: ParsedPartnerDocumentFile,
  extractedName: string | null,
  input: {
    partner: PartnerDocumentPartnerRow | null;
    action: PartnerDocumentAnalysisItem["action"];
    reason: string;
    match_source: DocumentMatchSource | null;
    match_status: DocumentMatchStatus;
    match_method: DocumentMatchMethod | null;
    match_confidence: number;
    review_status: DocumentReviewStatus;
    save_enabled: boolean;
    matched_document_id: string | null;
    is_primary: boolean;
  },
  extra?: { already_registered?: boolean; save_as_new_version?: boolean }
): PartnerDocumentAnalysisItem {
  return {
    ...row,
    extracted_partner_name: extractedName,
    matched_partner_id: input.partner?.id ?? null,
    matched_partner_name: input.partner?.company_name ?? null,
    match_source: input.match_source,
    match_status: input.match_status,
    match_method: input.match_method,
    match_confidence: input.match_confidence,
    review_status: input.review_status,
    save_enabled: input.save_enabled,
    action: input.action,
    reason: input.reason,
    is_primary: input.is_primary,
    priority_score: computeDocumentPriorityScore(row),
    matched_document_id: input.matched_document_id,
    suggested_partner_id: null,
    suggested_partner_name: null,
    suggested_partner_confidence: 0,
    partner_edit_source: null,
    already_registered: extra?.already_registered ?? false,
    save_as_new_version: extra?.save_as_new_version ?? false
  };
}

function skipItem(
  row: ParsedPartnerDocumentFile,
  extractedName: string | null,
  reason: string,
  partner: PartnerDocumentPartnerRow | null,
  match_source: DocumentMatchSource | null,
  match_method: DocumentMatchMethod | null,
  match_confidence: number
): PartnerDocumentAnalysisItem {
  return withSuggestionFields(
    buildAnalysisItem(row, extractedName, {
      partner,
      action: "skip",
      reason,
      match_source,
      match_status: "unmatched",
      match_method,
      match_confidence,
      review_status: "skipped",
      save_enabled: false,
      matched_document_id: null,
      is_primary: false
    }),
    null
  );
}

function buildCanonicalTypeMap(existingDocuments: PartnerDocumentDbRow[]) {
  const map = new Map<string, PartnerDocumentDbRow>();
  const buckets = new Map<string, PartnerDocumentDbRow[]>();

  for (const doc of existingDocuments) {
    if (!doc.document_type || !isVisibleDocument(doc)) continue;
    if (isMultiDocumentAllowed({ document_type: doc.document_type, original_filename: doc.original_filename })) {
      continue;
    }
    const key = `${doc.partner_id}:${doc.document_type}`;
    const bucket = buckets.get(key) ?? [];
    bucket.push(doc);
    buckets.set(key, bucket);
  }

  for (const [key, docs] of buckets.entries()) {
    const sorted = [...docs].sort((left, right) => {
      const leftTime = new Date(left.created_at ?? 0).getTime();
      const rightTime = new Date(right.created_at ?? 0).getTime();
      return rightTime - leftTime;
    });
    if (sorted[0]) map.set(key, sorted[0]);
  }

  return map;
}

function buildExistingMap(existingDocuments: PartnerDocumentDbRow[]) {
  const map = new Map<string, PartnerDocumentDbRow>();
  for (const doc of existingDocuments) {
    if (!doc.document_type || !doc.original_filename) continue;
    if (!isVisibleDocument(doc)) continue;
    const filename = doc.original_filename ?? doc.file_name;
    map.set(`${doc.partner_id}:${doc.document_type}:${normalizeOriginalFilename(filename)}`, doc);
  }
  return map;
}

function applyPrimaryFlags(items: PartnerDocumentAnalysisItem[]) {
  const groups = new Map<string, PartnerDocumentAnalysisItem[]>();

  for (const item of items) {
    if (!item.matched_partner_id || item.action === "skip" || !item.save_enabled) continue;
    if (item.already_registered && !item.save_as_new_version) continue;
    const key = `${item.matched_partner_id}:${item.document_type}`;
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  for (const group of groups.values()) {
    group.sort((left, right) => right.priority_score - left.priority_score);
    if (group[0]) group[0].is_primary = true;
  }
}

export { buildDocumentStoragePath, isSafeStorageObjectKey, coerceSafeStoragePath };

export function resolveSaveAction(
  item: Pick<
    PartnerDocumentAnalysisItem,
    | "action"
    | "matched_partner_id"
    | "matched_document_id"
    | "save_enabled"
    | "match_status"
    | "match_method"
    | "already_registered"
    | "save_as_new_version"
  >
): "create" | "update" | null {
  if (!item.save_enabled || !item.matched_partner_id) return null;
  if (item.already_registered && !item.save_as_new_version) return null;
  if (item.save_as_new_version && item.matched_partner_id) return "create";
  if (
    item.match_status !== "matched" &&
    item.match_method !== "manual" &&
    item.match_method !== "folder"
  ) {
    return null;
  }
  if (item.action === "create" || item.action === "update") return item.action;
  if (
    item.action === "review" &&
    (item.match_method === "manual" || item.match_method === "folder")
  ) {
    return item.matched_document_id ? "update" : "create";
  }
  return null;
}

export function applyManualPartnerSelection(
  item: PartnerDocumentAnalysisItem,
  partner: Pick<PartnerDocumentPartnerRow, "id" | "company_name"> | null
): PartnerDocumentAnalysisItem {
  if (!partner) {
    return {
      ...item,
      matched_partner_id: null,
      matched_partner_name: null,
      match_source: null,
      match_status: "needs_review",
      match_method: null,
      match_confidence: 0,
      action: "review",
      review_status: "needs_review",
      save_enabled: false,
      partner_edit_source: null,
      reason: "확인 필요 / 파트너 수동 선택"
    };
  }

  return finalizeEditableItem({
    ...item,
    matched_partner_id: partner.id,
    matched_partner_name: partner.company_name,
    match_source: "manual",
    match_status: "matched",
    match_method: "manual",
    match_confidence: 100,
    review_status: "auto_matched",
    partner_edit_source: "manual",
    reason: "수동 파트너 확인"
  });
}

export function applyRecommendedPartner(
  item: PartnerDocumentAnalysisItem,
  partner: Pick<PartnerDocumentPartnerRow, "id" | "company_name">
): PartnerDocumentAnalysisItem {
  const method: DocumentMatchMethod =
    !item.is_generic_folder && item.folder_match_candidates.length > 0 ? "folder" : "manual";

  return finalizeEditableItem({
    ...item,
    matched_partner_id: partner.id,
    matched_partner_name: partner.company_name,
    match_source: method === "folder" ? "folder" : "manual",
    match_status: "matched",
    match_method: method,
    match_confidence: item.suggested_partner_confidence || 100,
    review_status: "auto_matched",
    partner_edit_source: "suggested",
    reason: method === "folder" ? "폴더 추천 파트너 적용" : "추천 파트너 적용"
  });
}

export function applyDocumentTypeChange(
  item: PartnerDocumentAnalysisItem,
  documentType: PartnerDocumentAnalysisItem["document_type"]
): PartnerDocumentAnalysisItem {
  const display_name = buildAutoDisplayName({
    document_type: documentType,
    original_filename: item.original_filename
  });

  return finalizeEditableItem({
    ...item,
    document_type: documentType,
    display_name
  });
}

function finalizeEditableItem(item: PartnerDocumentAnalysisItem): PartnerDocumentAnalysisItem {
  if (!item.matched_partner_id || item.review_status === "skipped") {
    return { ...item, save_enabled: false, action: "review" };
  }

  return {
    ...item,
    action: item.matched_document_id ? "update" : "create",
    save_enabled: true
  };
}

export function getFolderGroupKey(item: PartnerDocumentAnalysisItem): string {
  return (item.source_folder_name ?? item.source_folder) || "(파일만)";
}

export function applyFolderBulkPartner(
  items: PartnerDocumentAnalysisItem[],
  folderKey: string,
  partner: Pick<PartnerDocumentPartnerRow, "id" | "company_name"> | null
): PartnerDocumentAnalysisItem[] {
  if (!partner) return items;

  return items.map((item) => {
    if (
      getFolderGroupKey(item) !== folderKey ||
      item.review_status === "skipped" ||
      item.is_generic_folder
    ) {
      return item;
    }

    return finalizeEditableItem({
      ...item,
      matched_partner_id: partner.id,
      matched_partner_name: partner.company_name,
      match_source: "manual",
      match_status: "matched",
      match_method: "folder",
      match_confidence: 100,
      review_status: "auto_matched",
      partner_edit_source: "folder_bulk",
      reason: "폴더 일괄 파트너 지정"
    });
  });
}

export { extractPartnerNameFromFolderPath };
