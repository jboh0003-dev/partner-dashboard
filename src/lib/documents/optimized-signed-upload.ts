import { createClient } from "@/lib/supabase/client";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { optimizePartnerUploadFile } from "@/lib/documents/optimize-upload-file";
import { readUploadApiJson } from "@/lib/imports/read-upload-api-json";

export type SignedDocumentUpload = {
  partnerId: string;
  file: File;
  documentType: string;
  displayName: string;
  receivedDate?: string | null;
  contractDate?: string | null;
  sourceFile?: string | null;
  note?: string | null;
};

export type SignedDocumentUploadResult = {
  status: "uploaded" | "reused";
  savedBytes: number;
  originalBytes: number;
  storedBytes: number;
  documentId: string;
};

function fileContentType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp"
  };
  return types[extension ?? ""] ?? "application/octet-stream";
}

async function sha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}

/**
 * One safe upload path for new partner ZIP documents and ordinary bulk uploads.
 *
 * 1. Optimize locally without changing original filename.
 * 2. Signed upload to a NEW path (never overwrite the existing document).
 * 3. Finalize only after the backend verifies Storage download bytes/hash.
 */
export async function uploadOptimizedPartnerDocument(
  input: SignedDocumentUpload
): Promise<SignedDocumentUploadResult> {
  const optimized = await optimizePartnerUploadFile(input.file);
  const file = optimized.file;
  const meta = {
    document_type: input.documentType,
    display_name: input.displayName,
    original_filename: input.file.name,
    file_size: file.size,
    file_hash: await sha256(file),
    content_type: fileContentType(file),
    received_date: input.receivedDate ?? null,
    contract_date: input.contractDate ?? null,
    source_file: input.sourceFile ?? null,
    note: input.note ?? null
  };
  const endpoint = "/api/partners/" + encodeURIComponent(input.partnerId) + "/documents/direct-upload";

  const prepare = await readUploadApiJson<{
    ok: boolean;
    reused: boolean;
    document_id?: string;
    path?: string;
    token?: string;
    message?: string;
  }>(await fetch(endpoint + "/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meta)
  }));

  if (prepare.reused) {
    if (!prepare.document_id) throw new Error("기존 문서 식별정보를 받지 못했습니다.");
    return {
      status: "reused",
      savedBytes: 0,
      originalBytes: input.file.size,
      storedBytes: file.size,
      documentId: prepare.document_id
    };
  }
  if (!prepare.path || !prepare.token) throw new Error("보안 업로드 경로가 없습니다.");

  const { error } = await createClient().storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .uploadToSignedUrl(prepare.path, prepare.token, file, {
      contentType: meta.content_type
    });
  if (error) throw new Error("Storage 업로드 실패: " + error.message);

  const finalized = await readUploadApiJson<{
    ok: boolean;
    document_id: string;
    reused?: boolean;
    message?: string;
  }>(await fetch(endpoint + "/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...meta, storage_path: prepare.path })
  }));

  return {
    status: finalized.reused ? "reused" : "uploaded",
    documentId: finalized.document_id,
    savedBytes: finalized.reused ? 0 : optimized.savedBytes,
    originalBytes: input.file.size,
    storedBytes: file.size
  };
}
