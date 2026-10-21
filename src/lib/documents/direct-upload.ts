import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_FILE_SIZE,
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

export type DirectDocumentUploadInput = {
  partnerId: string;
  documentType: string;
  displayName: string;
  originalFilename: string;
  fileSize: number;
  fileHash: string;
  contentType: string;
  receivedDate: string | null;
  note: string | null;
};

export type DirectDocumentPrepareResult =
  | {
      ok: true;
      reused: true;
      document_id: string;
    }
  | {
      ok: true;
      reused: false;
      path: string;
      token: string;
    }
  | { ok: false; message: string };

export type DirectDocumentFinalizeResult =
  | { ok: true; document_id: string; reused: boolean }
  | { ok: false; message: string };

function extensionFromFilename(fileName: string): string {
  return fileName.split(".").pop()?.trim().toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

function validateInput(input: DirectDocumentUploadInput): string | null {
  if (!DOCUMENT_TYPES.includes(input.documentType as (typeof DOCUMENT_TYPES)[number])) {
    return "지원하지 않는 문서 구분입니다.";
  }

  const ext = extensionFromFilename(input.originalFilename);
  if (!ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
    return `허용되지 않는 파일 형식입니다. (.${ext})`;
  }

  if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
    return "파일 크기를 확인할 수 없습니다.";
  }

  if (input.fileSize > MAX_DOCUMENT_FILE_SIZE) {
    return "파일 크기는 50MB를 초과할 수 없습니다.";
  }

  if (!/^[a-f0-9]{64}$/i.test(input.fileHash)) {
    return "파일 해시 형식이 올바르지 않습니다.";
  }

  if (!input.displayName.trim()) {
    return "표시 파일명이 필요합니다.";
  }

  return null;
}

async function findExactHashDocument(
  supabase: SupabaseClient,
  input: DirectDocumentUploadInput
) {
  const { data } = await supabase
    .from("partner_documents")
    .select("id, file_hash")
    .eq("partner_id", input.partnerId)
    .eq("document_type", input.documentType)
    .eq("file_hash", input.fileHash)
    .eq("is_active", true)
    .eq("is_duplicate", false)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  return data?.id ? { id: String(data.id), file_hash: String(data.file_hash ?? "") } : null;
}

async function resolveUploadTarget(
  supabase: SupabaseClient,
  input: DirectDocumentUploadInput
) {
  const fileExt = extensionFromFilename(input.originalFilename);
  const useCanonical = usesCanonicalTypeStorage(input.documentType, input.originalFilename);
  const canonical = useCanonical
    ? await findCanonicalDocumentForType(supabase, input.partnerId, input.documentType)
    : null;

  // 새 내용은 기존 canonical object를 덮어쓰지 않고 별도 object에 먼저 올린다.
  // DB finalize 성공 후 이전 object를 제거해 중간 실패 시 기존 다운로드가 깨지지 않게 한다.
  const contentIdentity = `${input.originalFilename}#${input.fileHash}`;
  const storagePath = resolveUploadStoragePath(
    input.partnerId,
    input.documentType,
    fileExt,
    contentIdentity
  );

  return { fileExt, useCanonical, canonical, storagePath };
}

export async function preparePartnerDocumentDirectUpload(
  supabase: SupabaseClient,
  input: DirectDocumentUploadInput
): Promise<DirectDocumentPrepareResult> {
  const validationError = validateInput(input);
  if (validationError) return { ok: false, message: validationError };

  const exact = await findExactHashDocument(supabase, input);
  if (exact) {
    return { ok: true, reused: true, document_id: exact.id };
  }

  const target = await resolveUploadTarget(supabase, input);
  if (!isSafeStorageObjectKey(target.storagePath)) {
    return { ok: false, message: "안전한 Storage 경로를 생성하지 못했습니다." };
  }

  const { data, error } = await supabase.storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .createSignedUploadUrl(target.storagePath, { upsert: true });

  if (error || !data?.token) {
    return {
      ok: false,
      message: error?.message ?? "업로드 URL 생성에 실패했습니다."
    };
  }

  return {
    ok: true,
    reused: false,
    path: target.storagePath,
    token: data.token
  };
}

async function verifyStorageObject(
  supabase: SupabaseClient,
  storagePath: string
): Promise<boolean> {
  const parts = storagePath.split("/");
  const filename = parts.pop();
  const folder = parts.join("/");
  if (!filename || !folder) return false;

  const { data, error } = await supabase.storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .list(folder, { limit: 100, search: filename });

  if (error) return false;
  return (data ?? []).some((item) => item.name === filename);
}

export async function finalizePartnerDocumentDirectUpload(
  supabase: SupabaseClient,
  input: DirectDocumentUploadInput & { storagePath: string }
): Promise<DirectDocumentFinalizeResult> {
  const validationError = validateInput(input);
  if (validationError) return { ok: false, message: validationError };

  if (!isSafeStorageObjectKey(input.storagePath)) {
    return { ok: false, message: "유효하지 않은 Storage 경로입니다." };
  }

  const expectedPrefix = `${input.partnerId}/${input.documentType}/`;
  if (!input.storagePath.startsWith(expectedPrefix)) {
    return { ok: false, message: "문서 저장 경로가 파트너/문서 구분과 일치하지 않습니다." };
  }

  const exact = await findExactHashDocument(supabase, input);
  if (exact) {
    return { ok: true, document_id: exact.id, reused: true };
  }

  const exists = await verifyStorageObject(supabase, input.storagePath);
  if (!exists) {
    return { ok: false, message: "Storage 업로드 완료 여부를 확인하지 못했습니다." };
  }

  const target = await resolveUploadTarget(supabase, input);
  if (target.storagePath !== input.storagePath) {
    return { ok: false, message: "준비된 업로드 경로와 최종 저장 경로가 다릅니다." };
  }

  const now = new Date().toISOString();
  const basePayload = {
    partner_id: input.partnerId,
    document_type: input.documentType,
    document_status: "active",
    original_filename: input.originalFilename.trim(),
    display_name: input.displayName.trim(),
    file_name: input.displayName.trim(),
    file_path: input.storagePath,
    storage_path: input.storagePath,
    file_ext: target.fileExt,
    file_size: input.fileSize,
    file_hash: input.fileHash,
    received_date: input.receivedDate,
    note: input.note,
    summary: input.note,
    source_file: "partner_onboarding_package",
    uploaded_by: "partner_onboarding_package",
    is_active: true,
    is_duplicate: false,
    duplicate_of: null,
    deleted_at: null,
    archived_at: null,
    archived_reason: null,
    match_status: "matched",
    review_status: "auto_matched",
    representative: true,
    is_primary: true,
    priority_score: 100,
    updated_at: now
  };

  try {
    if (target.useCanonical && target.canonical) {
      const previousPath = pickDocumentStoragePath(target.canonical);
      const { error: updateError } = await supabase
        .from("partner_documents")
        .update(basePayload)
        .eq("id", target.canonical.id);

      if (updateError) {
        return { ok: false, message: updateError.message };
      }

      if (previousPath && previousPath !== input.storagePath) {
        await removeDocumentStorage(supabase, previousPath);
      }

      await purgeSupersededDocumentsForType(
        supabase,
        input.partnerId,
        input.documentType,
        target.canonical.id
      );

      return {
        ok: true,
        document_id: target.canonical.id,
        reused: false
      };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("partner_documents")
      .insert(basePayload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      return {
        ok: false,
        message: insertError?.message ?? "문서 DB 등록에 실패했습니다."
      };
    }

    const documentId = String(inserted.id);

    if (target.useCanonical) {
      await purgeSupersededDocumentsForType(
        supabase,
        input.partnerId,
        input.documentType,
        documentId
      );
    }

    return { ok: true, document_id: documentId, reused: false };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "문서 DB 등록에 실패했습니다."
    };
  }
}

export function computeBrowserCompatibleFileHash(buffer: Buffer): string {
  return computeFileHash(buffer);
}