import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FULL_SYNC_IMPORT_TYPE } from "@/lib/imports/partner-contacts-sync";

export type ImportJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "completed_with_review"
  | "failed"
  | "cancelled";

export type ImportJobRow = {
  id: string;
  import_type: string;
  file_name: string;
  status: ImportJobStatus;
  total_rows: number | null;
  processed_rows: number | null;
  created_count: number | null;
  updated_count: number | null;
  skipped_count: number | null;
  review_count: number | null;
  error_message: string | null;
  idempotency_key: string | null;
  file_hash: string | null;
  created_at: string;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

/** updated_at이 이 시간 이상 갱신되지 않으면 stale */
export const IMPORT_JOB_STALE_MS = 15 * 60 * 1000;

export function buildContactFullDbIdempotencyKey(fileHash: string): string {
  return `${FULL_SYNC_IMPORT_TYPE}:${fileHash}`;
}

export function hashContactImportPayload(fileName: string, rows: unknown[]): string {
  const normalized = JSON.stringify({
    fileName: fileName.trim().toLowerCase(),
    rows
  });
  return createHash("sha256").update(normalized).digest("hex");
}

export function isTerminalImportStatus(status: string): boolean {
  return (
    status === "completed" ||
    status === "completed_with_review" ||
    status === "failed" ||
    status === "cancelled"
  );
}

export function isActiveImportStatus(status: string): boolean {
  return status === "pending" || status === "processing";
}

export function isStaleImportJob(job: {
  status: string;
  updated_at?: string | null;
  started_at?: string | null;
  created_at?: string | null;
}): boolean {
  if (!isActiveImportStatus(job.status)) return false;
  const anchor = job.updated_at ?? job.started_at ?? job.created_at;
  if (!anchor) return false;
  return Date.now() - new Date(anchor).getTime() > IMPORT_JOB_STALE_MS;
}

export async function findBlockingImportJob(
  supabase: SupabaseClient,
  idempotencyKey: string
): Promise<ImportJobRow | null> {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .in("status", ["pending", "processing", "completed", "completed_with_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error.message)) return null;
    throw new Error(error.message);
  }
  return (data as ImportJobRow | null) ?? null;
}

export async function createImportJob(
  supabase: SupabaseClient,
  input: {
    importType: string;
    fileName: string;
    totalRows: number;
    idempotencyKey: string;
    fileHash: string;
  }
): Promise<ImportJobRow> {
  const now = new Date().toISOString();
  const basePayload = {
    import_type: input.importType,
    file_name: input.fileName,
    status: "processing" as const,
    total_rows: input.totalRows,
    created_count: 0,
    updated_count: 0,
    skipped_count: 0,
    review_count: 0
  };

  const extendedPayload = {
    ...basePayload,
    processed_rows: 0,
    idempotency_key: input.idempotencyKey,
    file_hash: input.fileHash,
    started_at: now,
    updated_at: now
  };

  let { data, error } = await supabase
    .from("import_jobs")
    .insert(extendedPayload)
    .select("*")
    .single();

  // migration 039 미적용 환경 폴백
  if (error && isMissingColumnError(error.message)) {
    const fallback = await supabase
      .from("import_jobs")
      .insert(basePayload)
      .select("*")
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
      const existing = await findBlockingImportJob(supabase, input.idempotencyKey);
      throw new DuplicateImportJobError(
        existing?.status === "processing" || existing?.status === "pending"
          ? "이미 처리 중인 파일입니다. 완료되거나 취소될 때까지 기다려 주세요."
          : "이미 처리된 파일입니다. 재처리하려면 강제 재실행을 선택하세요.",
        existing
      );
    }
    throw new Error(error.message);
  }

  return data as ImportJobRow;
}

function isMissingColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("column") &&
    (lower.includes("does not exist") ||
      lower.includes("idempotency_key") ||
      lower.includes("file_hash") ||
      lower.includes("processed_rows") ||
      lower.includes("updated_at") ||
      lower.includes("started_at"))
  );
}

export class DuplicateImportJobError extends Error {
  existingJob: ImportJobRow | null;
  constructor(message: string, existingJob: ImportJobRow | null) {
    super(message);
    this.name = "DuplicateImportJobError";
    this.existingJob = existingJob;
  }
}

export async function updateImportJobProgress(
  supabase: SupabaseClient,
  jobId: string,
  processedRows: number
): Promise<void> {
  const { error } = await supabase
    .from("import_jobs")
    .update({ processed_rows: processedRows })
    .eq("id", jobId)
    .eq("status", "processing");
  if (error) throw new Error(error.message);
}

export async function isImportJobCancelled(
  supabase: SupabaseClient,
  jobId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("status")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.status === "cancelled";
}

export async function completeImportJob(
  supabase: SupabaseClient,
  jobId: string,
  input: {
    status: "completed" | "completed_with_review" | "failed" | "cancelled";
    createdCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    reviewCount?: number;
    processedRows?: number;
    errorMessage?: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("import_jobs")
    .update({
      status: input.status,
      created_count: input.createdCount ?? 0,
      updated_count: input.updatedCount ?? 0,
      skipped_count: input.skippedCount ?? 0,
      review_count: input.reviewCount ?? 0,
      processed_rows: input.processedRows,
      error_message: input.errorMessage ?? null,
      completed_at: now,
      cancelled_at: input.status === "cancelled" ? now : null
    })
    .eq("id", jobId);
  if (error) throw new Error(error.message);
}

export async function cancelImportJob(
  supabase: SupabaseClient,
  jobId: string,
  reason = "관리자가 작업을 취소했습니다."
): Promise<ImportJobRow> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("import_jobs")
    .update({
      status: "cancelled",
      cancelled_at: now,
      completed_at: now,
      error_message: reason
    })
    .eq("id", jobId)
    .in("status", ["pending", "processing"])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    const { data: current } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (!current) throw new Error("import job을 찾을 수 없습니다.");
    throw new Error(`취소할 수 없는 상태입니다: ${current.status}`);
  }
  return data as ImportJobRow;
}

export async function cancelStaleImportJobs(
  supabase: SupabaseClient,
  importType: string = FULL_SYNC_IMPORT_TYPE
): Promise<number> {
  const cutoff = new Date(Date.now() - IMPORT_JOB_STALE_MS).toISOString();
  const { data, error } = await supabase
    .from("import_jobs")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      error_message: "장시간 응답이 없어 자동 취소되었습니다 (stale)."
    })
    .eq("import_type", importType)
    .in("status", ["pending", "processing"])
    .lt("updated_at", cutoff)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function listRecentImportJobs(
  supabase: SupabaseClient,
  options?: { importType?: string; limit?: number }
): Promise<ImportJobRow[]> {
  let query = supabase
    .from("import_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 20);

  if (options?.importType) {
    query = query.eq("import_type", options.importType);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as ImportJobRow[];
}
