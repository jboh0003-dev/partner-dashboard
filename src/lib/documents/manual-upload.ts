import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  DOCUMENT_TYPE_LABEL,
  PARTNER_DOCUMENTS_BUCKET
} from "@/lib/documents/constants";
import {
  computeFileHash,
  findCanonicalDocumentForType,
  pickDocumentStoragePath,
  purgeSupersededDocumentsForType,
  removeDocumentStorage,
  usesCanonicalTypeStorage
} from "@/lib/documents/document-lifecycle";
import {
  isSafeStorageObjectKey,
  resolveCanonicalUploadStoragePath,
  resolveUploadStoragePath
} from "@/lib/documents/storage-path";

export const MANUAL_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
export const COMPANY_PROFILE_MAX_BYTES = 10 * 1024 * 1024;

export const MANUAL_UPLOAD_DOCUMENT_TYPES = [
  "partner_contract",
  "partner_application",
  "business_registration",
  "bank_account",
  "credit_rating",
  "security_commitment",
  "other"
] as const;

export type ManualUploadDocumentType = (typeof MANUAL_UPLOAD_DOCUMENT_TYPES)[number];
export type ManualUploadMode = "replace" | "add";

export type ManualUploadInput = {
  partnerId: string;
  documentType: string;
  displayName: string;
  contractDate: string | null;
  receivedDate: string | null;
  note: string | null;
  mode: ManualUploadMode;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
};

export type ManualUploadResult =
  | { ok: true; document_id: string; warnings: string[] }
  | { ok: false; message: string };

function sanitizeExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  return ext || "bin";
}

function validateUploadInput(input: ManualUploadInput): string | null {
  if (!MANUAL_UPLOAD_DOCUMENT_TYPES.includes(input.documentType as ManualUploadDocumentType)) {
    if (input.documentType === "company_profile") {
      return "회사소개서(company_profile)는 Storage 절감 정책으로 수동 업로드 대상에서 제외됩니다.";
    }
    return "지원하지 않는 문서 구분입니다.";
  }

  const ext = sanitizeExtension(input.fileName);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
    return `허용되지 않는 파일 형식입니다. (${ext})`;
  }

  if (input.fileBuffer.byteLength > MANUAL_UPLOAD_MAX_BYTES) {
    return "파일 크기는 20MB를 초과할 수 없습니다.";
  }

  if (!input.displayName.trim()) {
    return "표시 파일명을 입력해 주세요.";
  }

  return null;
}

function collectWarnings(input: ManualUploadInput): string[] {
  const warnings: string[] = [];
  if (input.documentType === "other") {
    warnings.push("기타 문서(other)는 Storage 사용량 증가에 주의해 주세요.");
  }
  if (input.fileBuffer.byteLength > 10 * 1024 * 1024) {
    warnings.push("10MB 이상 파일입니다. 업로드 전 용량을 확인해 주세요.");
  }
  return warnings;
}

async function rollbackUploadedFile(supabase: SupabaseClient, storagePath: string | null) {
  if (!storagePath) return;
  await removeDocumentStorage(supabase, storagePath);
}

export async function uploadPartnerDocumentManual(
  supabase: SupabaseClient,
  input: ManualUploadInput
): Promise<ManualUploadResult> {
  const validationError = validateUploadInput(input);
  if (validationError) {
    return { ok: false, message: validationError };
  }

  const warnings = collectWarnings(input);
  const fileHash = computeFileHash(input.fileBuffer);
  const fileExt = sanitizeExtension(input.fileName);
  const originalFilename = input.fileName.trim();
  const displayName = input.displayName.trim();
  const useCanonical = usesCanonicalTypeStorage(input.documentType, originalFilename);

  const existing = await findCanonicalDocumentForType(
    supabase,
    input.partnerId,
    input.documentType
  );

  const reuseExistingPath = input.mode === "replace" ? existing : null;

  const storagePath = useCanonical
    ? resolveCanonicalUploadStoragePath(
        input.partnerId,
        input.documentType,
        fileExt,
        originalFilename,
        reuseExistingPath?.storage_path,
        reuseExistingPath?.file_path,
        true
      )
    : resolveUploadStoragePath(
        input.partnerId,
        input.documentType,
        fileExt,
        originalFilename,
        reuseExistingPath?.storage_path,
        reuseExistingPath?.file_path
      );

  if (!isSafeStorageObjectKey(storagePath)) {
    return { ok: false, message: "안전한 Storage 경로를 생성하지 못했습니다." };
  }

  const previousPath =
    input.mode === "replace" && existing ? pickDocumentStoragePath(existing) : null;

  const { error: uploadError } = await supabase.storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .upload(storagePath, input.fileBuffer, {
      upsert: true,
      contentType: input.contentType || "application/octet-stream"
    });

  if (uploadError) {
    return { ok: false, message: uploadError.message };
  }

  const now = new Date().toISOString();
  const basePayload = {
    partner_id: input.partnerId,
    document_type: input.documentType,
    document_status: "active",
    original_filename: originalFilename,
    display_name: displayName,
    file_name: displayName,
    file_path: storagePath,
    storage_path: storagePath,
    file_ext: fileExt,
    file_size: input.fileBuffer.byteLength,
    file_hash: fileHash,
    contract_date: input.contractDate,
    received_date: input.receivedDate ?? input.contractDate,
    note: input.note,
    summary: input.note,
    source_file: "dashboard-manual",
    uploaded_by: "dashboard-manual",
    is_active: true,
    is_duplicate: false,
    duplicate_of: null,
    deleted_at: null,
    archived_at: null,
    archived_reason: null,
    match_status: "matched",
    review_status: "manually_confirmed"
  };

  try {
    if (input.mode === "replace" && existing) {
      if (existing.file_hash === fileHash && previousPath === storagePath) {
        return { ok: true, document_id: existing.id, warnings };
      }

      const { error: updateError } = await supabase
        .from("partner_documents")
        .update({
          ...basePayload,
          updated_at: now
        })
        .eq("id", existing.id);

      if (updateError) {
        await rollbackUploadedFile(supabase, storagePath);
        return { ok: false, message: updateError.message };
      }

      if (previousPath && previousPath !== storagePath) {
        await removeDocumentStorage(supabase, previousPath);
      }

      if (useCanonical) {
        await purgeSupersededDocumentsForType(
          supabase,
          input.partnerId,
          input.documentType,
          existing.id
        );
      }

      return { ok: true, document_id: existing.id, warnings };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("partner_documents")
      .insert({
        ...basePayload,
        is_primary: true,
        representative: true,
        priority_score: 100
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      await rollbackUploadedFile(supabase, storagePath);
      return { ok: false, message: insertError?.message ?? "문서 등록 실패" };
    }

    const documentId = String(inserted.id);

    if (input.mode === "replace" && useCanonical) {
      await purgeSupersededDocumentsForType(
        supabase,
        input.partnerId,
        input.documentType,
        documentId
      );
    }

    return { ok: true, document_id: documentId, warnings };
  } catch (error) {
    await rollbackUploadedFile(supabase, storagePath);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "문서 업로드 실패"
    };
  }
}

export function getManualUploadTypeLabel(documentType: string): string {
  return DOCUMENT_TYPE_LABEL[documentType] ?? documentType;
}

export async function checkExistingDocumentForType(
  supabase: SupabaseClient,
  partnerId: string,
  documentType: string
) {
  const existing = await findCanonicalDocumentForType(supabase, partnerId, documentType);
  if (!existing) return null;
  return {
    id: existing.id,
    display_name: existing.display_name ?? existing.file_name ?? existing.original_filename,
    document_type: existing.document_type,
    document_type_label: getManualUploadTypeLabel(existing.document_type ?? documentType)
  };
}
