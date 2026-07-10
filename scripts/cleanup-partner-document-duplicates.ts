/**
 * partner-documents Storage 중복 파일 정리
 *
 * storage.objects(PostgREST storage 스키마)가 프로젝트에 노출되지 않는 경우
 * Supabase Storage list API로 동일 bucket 객체를 조회합니다.
 * 나머지는 Supabase Storage API remove로 삭제합니다.
 *
 * Usage:
 *   npm run cleanup:storage:dry
 *   npm run cleanup:storage:delete
 *
 * 실제 삭제는 CONFIRM_DELETE=true 일 때만 실행됩니다.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_DOCUMENTS_BUCKET } from "../src/lib/documents/constants";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PAGE_SIZE = 1000;
const REMOVE_BATCH_SIZE = 50;
const OUTPUT_DIR = resolve(process.cwd(), "scripts", "output");

type StorageObjectRow = {
  id: string;
  name: string;
  bucket_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type ParsedObject = StorageObjectRow & {
  partner_id: string;
  document_type: string;
  filename: string;
  size_bytes: number;
};

type DeleteCandidate = ParsedObject & {
  group_key: string;
  keep_path: string;
  rank: number;
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

function parseStoragePath(name: string): Pick<ParsedObject, "partner_id" | "document_type" | "filename"> | null {
  const parts = name.split("/").filter(Boolean);
  if (parts.length < 3) return null;

  const [partner_id, document_type, ...filenameParts] = parts;
  if (!UUID_PATTERN.test(partner_id)) return null;

  return {
    partner_id,
    document_type,
    filename: filenameParts.join("/")
  };
}

function readObjectSize(metadata: Record<string, unknown> | null): number {
  const raw = metadata?.size ?? metadata?.contentLength ?? metadata?.content_length;
  const size = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

type StorageListItem = {
  name: string;
  id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function listStoragePage(
  supabase: SupabaseClient,
  prefix: string,
  offset: number
): Promise<StorageListItem[]> {
  const { data, error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).list(prefix, {
    limit: PAGE_SIZE,
    offset,
    sortBy: { column: "created_at", order: "asc" }
  });

  if (error) {
    throw new Error(`Storage list 실패 (${prefix || "/"}): ${error.message}`);
  }

  return (data ?? []) as StorageListItem[];
}

async function listAllAtPrefix(supabase: SupabaseClient, prefix: string): Promise<StorageListItem[]> {
  const items: StorageListItem[] = [];
  let offset = 0;

  while (true) {
    const page = await listStoragePage(supabase, prefix, offset);
    if (page.length === 0) break;
    items.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return items;
}

async function fetchAllStorageObjects(supabase: SupabaseClient): Promise<ParsedObject[]> {
  const results: ParsedObject[] = [];
  const partnerFolders = await listAllAtPrefix(supabase, "");

  for (const partnerFolder of partnerFolders) {
    if (partnerFolder.id !== null) continue;
    const partnerPath = partnerFolder.name;
    const typeFolders = await listAllAtPrefix(supabase, partnerPath);

    for (const typeFolder of typeFolders) {
      if (typeFolder.id !== null) continue;
      const typePath = `${partnerPath}/${typeFolder.name}`;
      const files = await listAllAtPrefix(supabase, typePath);

      for (const file of files) {
        if (file.id === null) continue;

        const fullPath = `${typePath}/${file.name}`;
        const parsed = parseStoragePath(fullPath);
        if (!parsed) continue;

        const metadata = file.metadata ?? null;
        results.push({
          id: file.id,
          name: fullPath,
          bucket_id: PARTNER_DOCUMENTS_BUCKET,
          created_at: file.created_at ?? file.updated_at ?? new Date(0).toISOString(),
          metadata,
          ...parsed,
          size_bytes: readObjectSize(metadata)
        });
      }
    }
  }

  return results;
}

function buildDeletePlan(objects: ParsedObject[]): DeleteCandidate[] {
  const groups = new Map<string, ParsedObject[]>();

  for (const object of objects) {
    const key = `${object.partner_id}:${object.document_type}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(object);
    groups.set(key, bucket);
  }

  const candidates: DeleteCandidate[] = [];

  for (const [group_key, bucket] of groups.entries()) {
    if (bucket.length < 2) continue;

    const sorted = [...bucket].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
    const keep = sorted[0]!;

    sorted.slice(1).forEach((object, index) => {
      candidates.push({
        ...object,
        group_key,
        keep_path: keep.name,
        rank: index + 2
      });
    });
  }

  return candidates.sort((left, right) => left.name.localeCompare(right.name, "en"));
}

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(path: string, rows: DeleteCandidate[]) {
  const headers = [
    "partner_id",
    "document_type",
    "storage_path",
    "filename",
    "created_at",
    "size_bytes",
    "rank",
    "keep_path",
    "action"
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.partner_id,
        row.document_type,
        row.name,
        row.filename,
        row.created_at,
        row.size_bytes,
        row.rank,
        row.keep_path,
        "delete"
      ]
        .map(csvEscape)
        .join(",")
    )
  ];

  writeFileSync(path, lines.join("\n"), "utf8");
}

async function markDocumentsDeleted(supabase: SupabaseClient, storagePath: string) {
  const now = new Date().toISOString();
  const columns = ["storage_path", "file_path"] as const;

  for (const column of columns) {
    const { error } = await supabase
      .from("partner_documents")
      .update({ deleted_at: now, document_status: "hidden" })
      .eq(column, storagePath)
      .is("deleted_at", null);

    if (error) {
      console.error(`[db] ${storagePath} (${column}) deleted_at 업데이트 실패: ${error.message}`);
    }
  }
}

async function deleteStorageObjects(
  supabase: SupabaseClient,
  candidates: DeleteCandidate[]
): Promise<{ deleted: number; failed: string[] }> {
  let deleted = 0;
  const failed: string[] = [];

  async function removeOne(path: string): Promise<boolean> {
    const { data, error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).remove([path]);
    if (error) {
      failed.push(`${path}: ${error.message}`);
      console.error(`[storage] 삭제 실패: ${path} — ${error.message}`);
      return false;
    }
    if (!data?.length) {
      failed.push(`${path}: Storage API가 삭제 결과를 반환하지 않았습니다.`);
      return false;
    }
    return true;
  }

  for (let index = 0; index < candidates.length; index += REMOVE_BATCH_SIZE) {
    const batch = candidates.slice(index, index + REMOVE_BATCH_SIZE);
    const paths = batch.map((row) => row.name);

    const { error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).remove(paths);

    if (error) {
      console.error(`[storage] batch remove 실패 (${paths.length}건), 개별 재시도: ${error.message}`);
      for (const candidate of batch) {
        const ok = await removeOne(candidate.name);
        if (!ok) continue;
        deleted += 1;
        await markDocumentsDeleted(supabase, candidate.name);
      }
      continue;
    }

    for (const candidate of batch) {
      deleted += 1;
      await markDocumentsDeleted(supabase, candidate.name);
    }
  }

  return { deleted, failed };
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
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

  console.log(`Bucket: ${PARTNER_DOCUMENTS_BUCKET}`);
  console.log(`Mode: ${confirmDelete ? "DELETE" : "DRY-RUN"}`);
  console.log("Storage 객체 조회 중...");

  const objects = await fetchAllStorageObjects(supabase);
  const candidates = buildDeletePlan(objects);
  const totalBytes = candidates.reduce((sum, row) => sum + row.size_bytes, 0);
  const duplicateGroups = new Set(candidates.map((row) => row.group_key)).size;

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvPath = resolve(
    OUTPUT_DIR,
    `partner-documents-storage-cleanup-${confirmDelete ? "delete" : "dry-run"}-${timestamp}.csv`
  );
  writeCsv(csvPath, candidates);

  console.log("");
  console.log(`스캔 객체 수: ${objects.length.toLocaleString("ko-KR")}`);
  console.log(`중복 그룹 수: ${duplicateGroups.toLocaleString("ko-KR")}`);
  console.log(`삭제 예정 파일 수: ${candidates.length.toLocaleString("ko-KR")}`);
  console.log(`예상 절감 용량: ${formatMb(totalBytes)} MB`);
  console.log(`CSV 저장: ${csvPath}`);

  if (!confirmDelete) {
    console.log("");
    console.log("DRY-RUN 완료. 실제 삭제는 CONFIRM_DELETE=true 로 실행하세요.");
    console.log("  npm run cleanup:storage:delete");
    return;
  }

  if (candidates.length === 0) {
    console.log("");
    console.log("삭제할 중복 파일이 없습니다.");
    return;
  }

  console.log("");
  console.log("Storage API remove 실행 중...");

  const { deleted, failed } = await deleteStorageObjects(supabase, candidates);

  console.log("");
  console.log(`삭제 성공: ${deleted.toLocaleString("ko-KR")}건`);
  console.log(`삭제 실패: ${failed.length.toLocaleString("ko-KR")}건`);

  if (failed.length > 0) {
    console.log("");
    console.log("실패 목록:");
    for (const message of failed) {
      console.log(`  - ${message}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
