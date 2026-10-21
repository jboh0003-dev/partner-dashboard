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