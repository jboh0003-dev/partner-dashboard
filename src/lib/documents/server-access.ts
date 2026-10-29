import { readArchivedDocument } from '@/lib/recovery/blob-storage';
import { database, recoveryEnabled } from "@/lib/recovery/database";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import {
  getDocumentContentType,
  getDocumentDownloadFileName,
  normalizeDocumentTypeKey,
  resolveDocumentExtension,
  type DocumentDisplaySource
} from "@/lib/documents/display";
import { isSafeStorageObjectKey } from "@/lib/documents/storage-path";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type PartnerDocumentRecord = DocumentDisplaySource & {
  id: string;
  storage_path: string | null;
  file_path: string | null;
  deleted_at: string | null;
  is_active: boolean | null;
  document_status: string | null;
  contract_date: string | null;
  partner_company_name: string | null;
};

const DOWNLOAD_TYPE_LABEL: Record<string, string> = {
  partner_contract: "파트너계약서",
  partner_application: "파트너신청서",
  business_registration: "사업자등록증",
  company_profile: "회사소개서",
  business_plan: "사업계획서",
  bank_account: "통장사본",
  credit_rating: "신용평가서",
  security_commitment: "보안확약서",
  platinum_agreement: "플래티넘부속합의서"
};

function cleanDownloadPartnerName(value: string | null | undefined): string | null {
  const cleaned = value
    ?.replace(/㈜/g, "")
    .replace(/\(주\)/gi, "")
    .replace(/주식회사/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function extractContractDateSuffix(
  contractDate: string | null | undefined,
  originalFilename: string | null | undefined
): string {
  const isoMatch = contractDate?.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `(${isoMatch[1]}.${isoMatch[2]})`;
  }

  const source = originalFilename ?? "";
  const compactMatch = source.match(/(?:^|[^\d])(\d{2})(\d{2})(\d{2})(?:[^\d]|$)/);
  if (!compactMatch) return "";

  const month = Number(compactMatch[2]);
  const day = Number(compactMatch[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";

  return `(${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")})`;
}

export function getPartnerDocumentDownloadFileName(
  document: PartnerDocumentRecord
): string {
  const partnerName = cleanDownloadPartnerName(document.partner_company_name);
  const documentType = normalizeDocumentTypeKey(document.document_type);
  const label = documentType ? DOWNLOAD_TYPE_LABEL[documentType] : null;

  if (!partnerName || !label) {
    return getDocumentDownloadFileName(document);
  }

  const ext = resolveDocumentExtension(document);
  const dateSuffix =
    documentType === "partner_contract"
      ? extractContractDateSuffix(document.contract_date, document.original_filename)
      : "";

  return `${partnerName}_${label}${dateSuffix}.${ext}`;
}

export async function fetchPartnerDocumentRecord(
  id: string
): Promise<{ document: PartnerDocumentRecord | null; error?: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_documents")
    .select(
      "id, storage_path, file_path, original_filename, file_name, display_name, file_ext, document_type, contract_date, deleted_at, is_active, document_status, partners(company_name)"
    )
    .eq("id", id)
    .single();

  if (
    error ||
    !data ||
    data.deleted_at ||
    data.is_active === false ||
    data.document_status === "archived"
  ) {
    return { document: null, error: "현재 사용할 수 없는 문서입니다." };
  }

  const row = data as typeof data & {
    partners?: { company_name?: string | null } | Array<{ company_name?: string | null }> | null;
  };
  const partner = Array.isArray(row.partners) ? row.partners[0] : row.partners;
  const { partners: _partners, ...document } = row;

  return {
    document: {
      ...document,
      partner_company_name: partner?.company_name ?? null
    } as PartnerDocumentRecord
  };
}

export function resolveDocumentStoragePath(document: PartnerDocumentRecord): string | null {
  const storagePath = [document.storage_path, document.file_path].find(
    (value): value is string => !!value && isSafeStorageObjectKey(value)
  );
  return storagePath ?? null;
}

async function readDocumentBackup(document: PartnerDocumentRecord, sourcePath: string) {
  try {
    const archived = await readArchivedDocument(document.id, sourcePath);
    if (archived) return archived;
  } catch (error) {
    console.error('Private document read failed', document.id, error instanceof Error ? error.message : 'unknown');
  }
  if (!process.env.CONNECT_DATABASE_URL) return null;
  try {
    const rows = await database()`select content from connect_recovery_private.document_backups where document_id=${document.id}::uuid and source_path=${sourcePath}`;
    return rows.length ? new Blob([new Uint8Array(rows[0].content)], { type: getDocumentContentType(document) }) : null;
  } catch (error) {
    console.error('Document backup read failed', document.id, error instanceof Error ? error.message : 'unknown');
    return null;
  }
}

export async function downloadPartnerDocumentBlob(document: PartnerDocumentRecord) {
  // Backups use exactly the same verified login requirement as normal downloads.
  const client = await createClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { blob: null as Blob | null, error: '로그인이 필요합니다.' };

  const storagePath = resolveDocumentStoragePath(document);
  if (!storagePath) {
    return { blob: null as Blob | null, error: "유효한 Storage 경로가 없습니다. 문서를 다시 업로드해 주세요." };
  }
  if (recoveryEnabled()) {
    const backup = await readDocumentBackup(document, storagePath);
    if (backup) return { blob: backup, error: undefined };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).download(storagePath);
  if (!error && data) return { blob: data, error: undefined };

  // Restoring Supabase authentication must not strand documents recovered during the outage.
  if (!recoveryEnabled()) {
    const backup = await readDocumentBackup(document, storagePath);
    if (backup) return { blob: backup, error: undefined };
  }
  return { blob: null as Blob | null, error: error?.message ?? "파일을 불러오지 못했습니다." };
}

export function buildContentDisposition(
  filename: string,
  disposition: "inline" | "attachment"
): string {
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_") || "document";
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function buildDocumentResponseHeaders(
  document: PartnerDocumentRecord,
  disposition: "inline" | "attachment"
): HeadersInit {
  const filename = getPartnerDocumentDownloadFileName(document);
  return {
    "Content-Type": getDocumentContentType(document),
    "Content-Disposition": buildContentDisposition(filename, disposition),
    "Cache-Control": "private, no-store"
  };
}
