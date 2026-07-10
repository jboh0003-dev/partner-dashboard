/**
 * Supabase Storage 비필수 파일 선택 정리
 *
 * 대상:
 * - partner-documents: document_type company_profile, other
 * - event-documents: 전체
 * - partner-policy-documents: 최신 1개만 유지
 *
 * 제외 (partner-documents):
 * - partner_contract, partner_application, bank_account,
 *   business_registration, credit_rating, security_commitment
 *
 * Usage:
 *   npm run cleanup:storage:nonessential:dry
 *   npm run cleanup:storage:nonessential:delete
 *
 * 실제 삭제는 CONFIRM_DELETE=true 일 때만 실행됩니다.
 * Storage 삭제는 Supabase Storage API remove()만 사용합니다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_DOCUMENTS_BUCKET } from "../src/lib/documents/constants";
import { EVENT_DOCUMENTS_BUCKET } from "../src/lib/events/event-storage";
import { PARTNER_POLICY_BUCKET } from "../src/lib/policy/constants";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 50;
const OUTPUT_DIR = resolve(process.cwd(), "scripts", "output");

const PROTECTED_PARTNER_DOCUMENT_TYPES = new Set([
  "partner_contract",
  "partner_application",
  "bank_account",
  "business_registration",
  "credit_rating",
  "security_commitment"
]);

const DELETE_PARTNER_DOCUMENT_TYPES = new Set(["company_profile", "other"]);

const ARCHIVE_REASON = "storage_cleanup_nonessential";

type StorageListItem = {
  name: string;
  id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type CleanupCandidate = {
  bucket: string;
  category: string;
  storage_path: string;
  created_at: string;
  size_bytes: number;
  partner_id: string;
  document_type: string;
  keep_path: string;
  action: "delete";
  status: "pending" | "deleted" | "failed";
  error_message: string;
};

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // .env.local optional if env already set
  }
}

function readObjectSize(metadata: Record<string, unknown> | null): number {
  const raw = metadata?.size ?? metadata?.contentLength ?? metadata?.content_length;
  const size = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(path: string, rows: CleanupCandidate[]) {
  const headers = [
    "bucket",
    "category",
    "storage_path",
    "partner_id",
    "document_type",
    "created_at",
    "size_bytes",
    "keep_path",
    "action",
    "status",
    "error_message"
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.bucket,
        row.category,
        row.storage_path,
        row.partner_id,
        row.document_type,
        row.created_at,
        row.size_bytes,
        row.keep_path,
        row.action,
        row.status,
        row.error_message
      ]
        .map(csvEscape)
        .join(",")
    )
  ];

  writeFileSync(path, lines.join("\n"), "utf8");
}

async function listStoragePage(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
  offset: number
): Promise<StorageListItem[]> {
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: PAGE_SIZE,
    offset,
    sortBy: { column: "created_at", order: "asc" }
  });

  if (error) {
    throw new Error(`Storage list 실패 (${bucket}/${prefix || "/"}): ${error.message}`);
  }

  return (data ?? []) as StorageListItem[];
}

async function listAllAtPrefix(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string
): Promise<StorageListItem[]> {
  const items: StorageListItem[] = [];
  let offset = 0;

  while (true) {
    const page = await listStoragePage(supabase, bucket, prefix, offset);
    if (page.length === 0) break;
    items.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return items;
}

async function listAllFilesRecursive(
  supabase: SupabaseClient,
  bucket: string,
  prefix = ""
): Promise<Array<{ path: string; created_at: string; size_bytes: number }>> {
  const entries = await listAllAtPrefix(supabase, bucket, prefix);
  const files: Array<{ path: string; created_at: string; size_bytes: number }> = [];

  for (const entry of entries) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.id === null) {
      const nested = await listAllFilesRecursive(supabase, bucket, entryPath);
      files.push(...nested);
      continue;
    }

    files.push({
      path: entryPath,
      created_at: entry.created_at ?? entry.updated_at ?? new Date(0).toISOString(),
      size_bytes: readObjectSize(entry.metadata ?? null)
    });
  }

  return files;
}

function parsePartnerDocumentPath(
  storagePath: string
): { partner_id: string; document_type: string } | null {
  const parts = storagePath.split("/").filter(Boolean);
  if (parts.length < 3) return null;

  const [partner_id, document_type] = parts;
  if (!UUID_PATTERN.test(partner_id)) return null;

  return { partner_id, document_type };
}

async function buildPartnerDocumentCandidates(
  supabase: SupabaseClient
): Promise<CleanupCandidate[]> {
  const files = await listAllFilesRecursive(supabase, PARTNER_DOCUMENTS_BUCKET);
  const candidates: CleanupCandidate[] = [];

  for (const file of files) {
    const parsed = parsePartnerDocumentPath(file.path);
    if (!parsed) continue;

    if (PROTECTED_PARTNER_DOCUMENT_TYPES.has(parsed.document_type)) continue;
    if (!DELETE_PARTNER_DOCUMENT_TYPES.has(parsed.document_type)) continue;

    candidates.push({
      bucket: PARTNER_DOCUMENTS_BUCKET,
      category: `partner_documents:${parsed.document_type}`,
      storage_path: file.path,
      created_at: file.created_at,
      size_bytes: file.size_bytes,
      partner_id: parsed.partner_id,
      document_type: parsed.document_type,
      keep_path: "",
      action: "delete",
      status: "pending",
      error_message: ""
    });
  }

  return candidates.sort((left, right) => left.storage_path.localeCompare(right.storage_path, "en"));
}

async function buildEventDocumentCandidates(
  supabase: SupabaseClient
): Promise<CleanupCandidate[]> {
  const files = await listAllFilesRecursive(supabase, EVENT_DOCUMENTS_BUCKET);

  return files
    .map((file) => ({
      bucket: EVENT_DOCUMENTS_BUCKET,
      category: "event_documents:all",
      storage_path: file.path,
      created_at: file.created_at,
      size_bytes: file.size_bytes,
      partner_id: "",
      document_type: "",
      keep_path: "",
      action: "delete" as const,
      status: "pending" as const,
      error_message: ""
    }))
    .sort((left, right) => left.storage_path.localeCompare(right.storage_path, "en"));
}

async function buildPolicyDocumentCandidates(
  supabase: SupabaseClient
): Promise<CleanupCandidate[]> {
  const files = await listAllFilesRecursive(supabase, PARTNER_POLICY_BUCKET);
  if (files.length <= 1) return [];

  const sorted = [...files].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );
  const keep = sorted[0]!;

  return sorted
    .slice(1)
    .map((file) => ({
      bucket: PARTNER_POLICY_BUCKET,
      category: "partner_policy_documents:superseded",
      storage_path: file.path,
      created_at: file.created_at,
      size_bytes: file.size_bytes,
      partner_id: "",
      document_type: "",
      keep_path: keep.path,
      action: "delete" as const,
      status: "pending" as const,
      error_message: ""
    }))
    .sort((left, right) => left.storage_path.localeCompare(right.storage_path, "en"));
}

let eventDocArchiveColumns: boolean | null = null;

async function detectEventDocArchiveColumns(supabase: SupabaseClient): Promise<boolean> {
  if (eventDocArchiveColumns !== null) return eventDocArchiveColumns;

  const { error } = await supabase
    .from("partner_event_documents")
    .select("archived_at, archived_reason")
    .limit(1);

  eventDocArchiveColumns = !error;
  return eventDocArchiveColumns;
}

async function archivePartnerDocument(supabase: SupabaseClient, storagePath: string) {
  const now = new Date().toISOString();
  const columns = ["storage_path", "file_path"] as const;

  for (const column of columns) {
    const { error } = await supabase
      .from("partner_documents")
      .update({
        document_status: "archived",
        archived_at: now,
        archived_reason: ARCHIVE_REASON
      })
      .eq(column, storagePath)
      .neq("document_status", "archived");

    if (error) {
      console.error(`[db] partner_documents ${storagePath} (${column}) archive 실패: ${error.message}`);
    }
  }
}

async function archiveEventDocument(supabase: SupabaseClient, storagePath: string) {
  const hasArchiveColumns = await detectEventDocArchiveColumns(supabase);

  if (hasArchiveColumns) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("partner_event_documents")
      .update({
        archived_at: now,
        archived_reason: ARCHIVE_REASON,
        is_active: false
      })
      .eq("storage_path", storagePath);

    if (error) {
      console.error(`[db] partner_event_documents ${storagePath} archive 실패: ${error.message}`);
    }
    return;
  }

  const { error } = await supabase
    .from("partner_event_documents")
    .update({
      is_active: false,
      exclude_reason: ARCHIVE_REASON,
      upload_status: "exclude",
      file_status: "excluded"
    })
    .eq("storage_path", storagePath);

  if (error) {
    console.warn(
      `[db] partner_event_documents ${storagePath} soft-archive 실패 (CSV만 기록): ${error.message}`
    );
  }
}

async function removeStorageObject(
  supabase: SupabaseClient,
  bucket: string,
  path: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return { ok: false, error: "Storage API가 삭제 결과를 반환하지 않았습니다." };
  }
  return { ok: true };
}

async function deleteCandidates(
  supabase: SupabaseClient,
  candidates: CleanupCandidate[]
): Promise<CleanupCandidate[]> {
  const results: CleanupCandidate[] = [];

  for (let index = 0; index < candidates.length; index += REMOVE_BATCH_SIZE) {
    const batch = candidates.slice(index, index + REMOVE_BATCH_SIZE);
    const byBucket = new Map<string, CleanupCandidate[]>();

    for (const candidate of batch) {
      const bucketRows = byBucket.get(candidate.bucket) ?? [];
      bucketRows.push(candidate);
      byBucket.set(candidate.bucket, bucketRows);
    }

    for (const [bucket, rows] of byBucket.entries()) {
      const paths = rows.map((row) => row.storage_path);
      const { error } = await supabase.storage.from(bucket).remove(paths);

      if (error) {
        console.error(`[storage] batch remove 실패 (${bucket}, ${paths.length}건): ${error.message}`);
        for (const candidate of rows) {
          const result = await removeStorageObject(supabase, bucket, candidate.storage_path);
          const row: CleanupCandidate = {
            ...candidate,
            status: result.ok ? "deleted" : "failed",
            error_message: result.error ?? ""
          };
          results.push(row);

          if (!result.ok) continue;

          if (bucket === PARTNER_DOCUMENTS_BUCKET) {
            await archivePartnerDocument(supabase, candidate.storage_path);
          } else if (bucket === EVENT_DOCUMENTS_BUCKET) {
            await archiveEventDocument(supabase, candidate.storage_path);
          }
        }
        continue;
      }

      for (const candidate of rows) {
        results.push({ ...candidate, status: "deleted", error_message: "" });

        if (bucket === PARTNER_DOCUMENTS_BUCKET) {
          await archivePartnerDocument(supabase, candidate.storage_path);
        } else if (bucket === EVENT_DOCUMENTS_BUCKET) {
          await archiveEventDocument(supabase, candidate.storage_path);
        }
      }
    }
  }

  return results.sort((left, right) => left.storage_path.localeCompare(right.storage_path, "en"));
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function summarizeByCategory(candidates: CleanupCandidate[]) {
  const summary = new Map<string, { count: number; bytes: number }>();

  for (const row of candidates) {
    const current = summary.get(row.category) ?? { count: 0, bytes: 0 };
    current.count += 1;
    current.bytes += row.size_bytes;
    summary.set(row.category, current);
  }

  return [...summary.entries()].sort((left, right) => left[0].localeCompare(right[0], "en"));
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(".env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  }

  const confirmDelete = process.env.CONFIRM_DELETE === "true";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log(`Mode: ${confirmDelete ? "DELETE" : "DRY-RUN"}`);
  console.log("Storage 객체 조회 중...");

  const [partnerCandidates, eventCandidates, policyCandidates] = await Promise.all([
    buildPartnerDocumentCandidates(supabase),
    buildEventDocumentCandidates(supabase),
    buildPolicyDocumentCandidates(supabase)
  ]);

  const candidates = [...partnerCandidates, ...eventCandidates, ...policyCandidates];
  const totalBytes = candidates.reduce((sum, row) => sum + row.size_bytes, 0);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvPath = resolve(
    OUTPUT_DIR,
    `storage-nonessential-cleanup-${confirmDelete ? "delete" : "dry-run"}-${timestamp}.csv`
  );
  writeCsv(csvPath, candidates);

  console.log("");
  console.log("=== 삭제 예정 요약 ===");
  for (const [category, stats] of summarizeByCategory(candidates)) {
    console.log(
      `  ${category}: ${stats.count.toLocaleString("ko-KR")}건, ${formatMb(stats.bytes)} MB`
    );
  }

  console.log("");
  console.log(`삭제 예정 파일 수: ${candidates.length.toLocaleString("ko-KR")}`);
  console.log(`예상 절감 용량: ${formatMb(totalBytes)} MB`);
  console.log(`CSV 저장: ${csvPath}`);

  if (!confirmDelete) {
    console.log("");
    console.log("DRY-RUN 완료. 실제 삭제는 CONFIRM_DELETE=true 로 실행하세요.");
    console.log("  npm run cleanup:storage:nonessential:delete");
    return;
  }

  if (candidates.length === 0) {
    console.log("");
    console.log("삭제할 파일이 없습니다.");
    return;
  }

  console.log("");
  console.log("Storage API remove 실행 중...");

  const results = await deleteCandidates(supabase, candidates);
  const deleted = results.filter((row) => row.status === "deleted").length;
  const failed = results.filter((row) => row.status === "failed");

  const resultCsvPath = resolve(
    OUTPUT_DIR,
    `storage-nonessential-cleanup-delete-result-${timestamp}.csv`
  );
  writeCsv(resultCsvPath, results);

  console.log("");
  console.log(`삭제 성공: ${deleted.toLocaleString("ko-KR")}건`);
  console.log(`삭제 실패: ${failed.length.toLocaleString("ko-KR")}건`);
  console.log(`결과 CSV 저장: ${resultCsvPath}`);

  if (failed.length > 0) {
    console.log("");
    console.log("실패 목록:");
    for (const row of failed) {
      console.log(`  - ${row.bucket}/${row.storage_path}: ${row.error_message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
