/**
 * partner-documents Storage 진단 (dry-run)
 * - 실제 삭제 없음
 * - Storage API list + DB partner_documents 조인으로 분류
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_DOCUMENTS_BUCKET, DOCUMENT_TYPE_LABEL } from "@/lib/documents/constants";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 1000;

/** 자동 삭제 금지 문서 유형 */
export const PROTECTED_DOCUMENT_TYPES = new Set([
  "partner_contract",
  "partner_application",
  "business_registration",
  "bank_account",
  "credit_rating",
  "security_commitment",
  "platinum_agreement",
  "contract"
]);

const TEMP_NAME_PATTERN = /(^|\/)(tmp|temp|test|fixture|sample|demo)([\/._-]|$)/i;

export type StorageObjectInfo = {
  path: string;
  id: string;
  partner_id: string | null;
  document_type: string | null;
  filename: string;
  size_bytes: number;
  created_at: string | null;
  etag: string | null;
  mimetype: string | null;
};

export type DbDocumentInfo = {
  id: string;
  partner_id: string;
  document_type: string | null;
  storage_path: string | null;
  file_path: string | null;
  file_name: string | null;
  file_hash: string | null;
  file_size: number | null;
  is_primary: boolean;
  is_duplicate: boolean;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string | null;
  partner_deleted_at: string | null;
  partner_name: string | null;
};

export type AuditClassification =
  | "linked_ok"
  | "orphan_storage"
  | "missing_storage"
  | "exact_duplicate"
  | "version_candidate"
  | "temp_or_test"
  | "deleted_partner"
  | "manual_review";

export type AuditItem = {
  classification: AuditClassification;
  deletable: boolean;
  reason: string;
  storage_path: string | null;
  document_id: string | null;
  partner_id: string | null;
  partner_name: string | null;
  document_type: string | null;
  size_bytes: number;
  created_at: string | null;
  keep_path?: string | null;
};

export type AuditSummary = {
  generated_at: string;
  bucket: string;
  totals: {
    storage_files: number;
    storage_bytes: number;
    db_documents: number;
  };
  by_classification: Record<
    AuditClassification,
    { count: number; bytes: number }
  >;
  by_document_type: Array<{ document_type: string; label: string; count: number; bytes: number }>;
  items: AuditItem[];
  safe_delete_candidates: AuditItem[];
  estimated_reclaim_bytes: number;
};

type StorageListItem = {
  name: string;
  id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

function readSize(metadata: Record<string, unknown> | null | undefined): number {
  const raw = metadata?.size ?? metadata?.contentLength ?? metadata?.content_length;
  const size = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(size) && size > 0 ? size : 0;
}

function readEtag(metadata: Record<string, unknown> | null | undefined): string | null {
  const raw = metadata?.eTag ?? metadata?.etag ?? metadata?.checksum;
  return raw != null ? String(raw) : null;
}

function readMime(metadata: Record<string, unknown> | null | undefined): string | null {
  const raw = metadata?.mimetype ?? metadata?.contentType ?? metadata?.content_type;
  return raw != null ? String(raw) : null;
}

function parsePath(path: string): {
  partner_id: string | null;
  document_type: string | null;
  filename: string;
} {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 3) {
    return { partner_id: null, document_type: null, filename: parts.at(-1) ?? path };
  }
  const [partner_id, document_type, ...rest] = parts;
  return {
    partner_id: UUID_PATTERN.test(partner_id) ? partner_id : null,
    document_type: document_type || null,
    filename: rest.join("/")
  };
}

async function listAllAtPrefix(supabase: SupabaseClient, prefix: string): Promise<StorageListItem[]> {
  const items: StorageListItem[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw new Error(`Storage list 실패 (${prefix || "/"}): ${error.message}`);
    const page = (data ?? []) as StorageListItem[];
    if (page.length === 0) break;
    items.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return items;
}

export async function listPartnerDocumentStorageObjects(
  supabase: SupabaseClient
): Promise<StorageObjectInfo[]> {
  const results: StorageObjectInfo[] = [];
  const roots = await listAllAtPrefix(supabase, "");

  for (const partnerFolder of roots) {
    // 폴더는 id === null
    if (partnerFolder.id !== null) {
      // 루트에 파일이 직접 있는 경우
      const path = partnerFolder.name;
      const parsed = parsePath(path);
      results.push({
        path,
        id: partnerFolder.id,
        partner_id: parsed.partner_id,
        document_type: parsed.document_type,
        filename: parsed.filename,
        size_bytes: readSize(partnerFolder.metadata),
        created_at: partnerFolder.created_at ?? partnerFolder.updated_at ?? null,
        etag: readEtag(partnerFolder.metadata),
        mimetype: readMime(partnerFolder.metadata)
      });
      continue;
    }

    const partnerPath = partnerFolder.name;
    const typeFolders = await listAllAtPrefix(supabase, partnerPath);
    for (const typeFolder of typeFolders) {
      if (typeFolder.id !== null) {
        const path = `${partnerPath}/${typeFolder.name}`;
        const parsed = parsePath(path);
        results.push({
          path,
          id: typeFolder.id,
          partner_id: parsed.partner_id,
          document_type: parsed.document_type,
          filename: parsed.filename,
          size_bytes: readSize(typeFolder.metadata),
          created_at: typeFolder.created_at ?? typeFolder.updated_at ?? null,
          etag: readEtag(typeFolder.metadata),
          mimetype: readMime(typeFolder.metadata)
        });
        continue;
      }

      const typePath = `${partnerPath}/${typeFolder.name}`;
      const files = await listAllAtPrefix(supabase, typePath);
      for (const file of files) {
        if (file.id === null) continue;
        const path = `${typePath}/${file.name}`;
        const parsed = parsePath(path);
        results.push({
          path,
          id: file.id,
          partner_id: parsed.partner_id,
          document_type: parsed.document_type,
          filename: parsed.filename,
          size_bytes: readSize(file.metadata),
          created_at: file.created_at ?? file.updated_at ?? null,
          etag: readEtag(file.metadata),
          mimetype: readMime(file.metadata)
        });
      }
    }
  }

  return results;
}

export async function fetchPartnerDocumentsForAudit(
  supabase: SupabaseClient
): Promise<DbDocumentInfo[]> {
  const rows: DbDocumentInfo[] = [];
  let from = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("partner_documents")
      .select(
        "id, partner_id, document_type, storage_path, file_path, file_name, file_hash, file_size, is_primary, is_duplicate, is_active, deleted_at, created_at, partners(company_name, deleted_at)"
      )
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    for (const row of page) {
      const partners = row.partners as
        | { company_name?: string; deleted_at?: string | null }
        | { company_name?: string; deleted_at?: string | null }[]
        | null;
      const partner = Array.isArray(partners) ? partners[0] : partners;
      rows.push({
        id: String(row.id),
        partner_id: String(row.partner_id),
        document_type: (row.document_type as string | null) ?? null,
        storage_path: (row.storage_path as string | null) ?? null,
        file_path: (row.file_path as string | null) ?? null,
        file_name: (row.file_name as string | null) ?? null,
        file_hash: (row.file_hash as string | null) ?? null,
        file_size: row.file_size != null ? Number(row.file_size) : null,
        is_primary: Boolean(row.is_primary),
        is_duplicate: Boolean(row.is_duplicate),
        is_active: row.is_active !== false,
        deleted_at: (row.deleted_at as string | null) ?? null,
        created_at: (row.created_at as string | null) ?? null,
        partner_deleted_at: partner?.deleted_at ?? null,
        partner_name: partner?.company_name ?? null
      });
    }
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function emptyClassCounts(): Record<AuditClassification, { count: number; bytes: number }> {
  return {
    linked_ok: { count: 0, bytes: 0 },
    orphan_storage: { count: 0, bytes: 0 },
    missing_storage: { count: 0, bytes: 0 },
    exact_duplicate: { count: 0, bytes: 0 },
    version_candidate: { count: 0, bytes: 0 },
    temp_or_test: { count: 0, bytes: 0 },
    deleted_partner: { count: 0, bytes: 0 },
    manual_review: { count: 0, bytes: 0 }
  };
}

function pushItem(
  items: AuditItem[],
  counts: Record<AuditClassification, { count: number; bytes: number }>,
  item: AuditItem
) {
  items.push(item);
  counts[item.classification].count += 1;
  counts[item.classification].bytes += item.size_bytes;
}

export function buildPartnerDocumentsAudit(
  storageObjects: StorageObjectInfo[],
  dbDocuments: DbDocumentInfo[]
): AuditSummary {
  const items: AuditItem[] = [];
  const counts = emptyClassCounts();

  const dbByPath = new Map<string, DbDocumentInfo[]>();
  for (const doc of dbDocuments) {
    const path = (doc.storage_path || doc.file_path || "").replace(/^\/+/, "");
    if (!path) continue;
    const list = dbByPath.get(path) ?? [];
    list.push(doc);
    dbByPath.set(path, list);
  }

  const storageByPath = new Map(storageObjects.map((o) => [o.path, o]));

  // 1) Storage 기준 분류
  for (const obj of storageObjects) {
    const linked = dbByPath.get(obj.path) ?? [];
    const size = obj.size_bytes;

    if (TEMP_NAME_PATTERN.test(obj.path) || !obj.partner_id) {
      pushItem(items, counts, {
        classification: "temp_or_test",
        deletable: false,
        reason: !obj.partner_id
          ? "파트너 ID 없는 경로 — 수동 검토"
          : "임시/테스트 경로 패턴 — 수동 검토",
        storage_path: obj.path,
        document_id: linked[0]?.id ?? null,
        partner_id: obj.partner_id,
        partner_name: linked[0]?.partner_name ?? null,
        document_type: obj.document_type,
        size_bytes: size,
        created_at: obj.created_at
      });
      continue;
    }

    if (linked.length === 0) {
      const recent =
        obj.created_at &&
        Date.now() - new Date(obj.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
      pushItem(items, counts, {
        classification: recent ? "manual_review" : "orphan_storage",
        deletable: false,
        reason: recent
          ? "DB 미연결 + 최근 7일 이내 생성 — 업로드 중일 수 있음"
          : "Storage만 존재 (고아 파일) — dry-run 후보, 자동 삭제 금지",
        storage_path: obj.path,
        document_id: null,
        partner_id: obj.partner_id,
        partner_name: null,
        document_type: obj.document_type,
        size_bytes: size,
        created_at: obj.created_at
      });
      continue;
    }

    const softDeletedPartner = linked.some((d) => d.partner_deleted_at);
    if (softDeletedPartner) {
      pushItem(items, counts, {
        classification: "deleted_partner",
        deletable: false,
        reason: "soft-delete 파트너 연결 문서 — 자동 삭제 금지",
        storage_path: obj.path,
        document_id: linked[0]?.id ?? null,
        partner_id: obj.partner_id,
        partner_name: linked[0]?.partner_name ?? null,
        document_type: obj.document_type,
        size_bytes: size,
        created_at: obj.created_at
      });
      continue;
    }

    pushItem(items, counts, {
      classification: "linked_ok",
      deletable: false,
      reason: "DB·Storage 정상 연결",
      storage_path: obj.path,
      document_id: linked[0]?.id ?? null,
      partner_id: obj.partner_id,
      partner_name: linked[0]?.partner_name ?? null,
      document_type: obj.document_type,
      size_bytes: size,
      created_at: obj.created_at
    });
  }

  // 2) DB만 있고 Storage 없음
  for (const doc of dbDocuments) {
    if (doc.deleted_at) continue;
    const path = (doc.storage_path || doc.file_path || "").replace(/^\/+/, "");
    if (!path) {
      pushItem(items, counts, {
        classification: "manual_review",
        deletable: false,
        reason: "storage_path 없음",
        storage_path: null,
        document_id: doc.id,
        partner_id: doc.partner_id,
        partner_name: doc.partner_name,
        document_type: doc.document_type,
        size_bytes: doc.file_size ?? 0,
        created_at: doc.created_at
      });
      continue;
    }
    if (!storageByPath.has(path)) {
      pushItem(items, counts, {
        classification: "missing_storage",
        deletable: false,
        reason: "DB 레코드만 존재 (Storage 유실)",
        storage_path: path,
        document_id: doc.id,
        partner_id: doc.partner_id,
        partner_name: doc.partner_name,
        document_type: doc.document_type,
        size_bytes: doc.file_size ?? 0,
        created_at: doc.created_at
      });
    }
  }

  // 3) 동일 파트너·유형 내 중복 (hash/etag/size+name)
  const groups = new Map<string, StorageObjectInfo[]>();
  for (const obj of storageObjects) {
    if (!obj.partner_id || !obj.document_type) continue;
    const key = `${obj.partner_id}::${obj.document_type}`;
    const list = groups.get(key) ?? [];
    list.push(obj);
    groups.set(key, list);
  }

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const byFingerprint = new Map<string, StorageObjectInfo[]>();
    for (const obj of group) {
      const dbDocs = dbByPath.get(obj.path) ?? [];
      const hash = dbDocs.find((d) => d.file_hash)?.file_hash;
      const fingerprint =
        hash ||
        obj.etag ||
        `${obj.size_bytes}|${obj.mimetype ?? ""}|${obj.filename.toLowerCase()}`;
      const bucket = byFingerprint.get(fingerprint) ?? [];
      bucket.push(obj);
      byFingerprint.set(fingerprint, bucket);
    }

    for (const [fingerprint, dupes] of byFingerprint) {
      if (dupes.length < 2) {
        // 동일 유형 다수지만 fingerprint 다름 → 버전 후보
        if (group.length >= 2 && fingerprint) {
          // handled once below
        }
        continue;
      }
      const sorted = [...dupes].sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );
      const keep = sorted[0]!;
      const protectedType = PROTECTED_DOCUMENT_TYPES.has(keep.document_type ?? "");

      for (const dup of sorted.slice(1)) {
        // linked_ok 항목을 exact_duplicate로 재분류하기 위해 추가 레코드
        pushItem(items, counts, {
          classification: "exact_duplicate",
          deletable: !protectedType && Boolean(fingerprint),
          reason: protectedType
            ? "보호 문서 유형의 동일 파일 — 자동 삭제 금지, 수동 검토"
            : `동일 fingerprint(${fingerprint.slice(0, 24)}) — 최신 유지, 나머지 안전 삭제 후보`,
          storage_path: dup.path,
          document_id: (dbByPath.get(dup.path) ?? [])[0]?.id ?? null,
          partner_id: dup.partner_id,
          partner_name: (dbByPath.get(dup.path) ?? [])[0]?.partner_name ?? null,
          document_type: dup.document_type,
          size_bytes: dup.size_bytes,
          created_at: dup.created_at,
          keep_path: keep.path
        });
      }
    }

    // fingerprint가 서로 다른 다수 파일 → 버전
    if (byFingerprint.size >= 2 || (group.length >= 2 && byFingerprint.size === 1 && [...byFingerprint.values()][0]!.length === 1)) {
      const distinct = [...byFingerprint.values()].filter((g) => g.length === 1).flat();
      if (group.length >= 2 && byFingerprint.size >= 2) {
        for (const obj of distinct) {
          pushItem(items, counts, {
            classification: "version_candidate",
            deletable: false,
            reason: "동일 파트너·문서유형의 다른 내용/버전 — 보존",
            storage_path: obj.path,
            document_id: (dbByPath.get(obj.path) ?? [])[0]?.id ?? null,
            partner_id: obj.partner_id,
            partner_name: (dbByPath.get(obj.path) ?? [])[0]?.partner_name ?? null,
            document_type: obj.document_type,
            size_bytes: obj.size_bytes,
            created_at: obj.created_at
          });
        }
      }
    }
  }

  const byTypeMap = new Map<string, { count: number; bytes: number }>();
  for (const obj of storageObjects) {
    const key = obj.document_type || "unknown";
    const cur = byTypeMap.get(key) ?? { count: 0, bytes: 0 };
    cur.count += 1;
    cur.bytes += obj.size_bytes;
    byTypeMap.set(key, cur);
  }

  const safe_delete_candidates = items.filter(
    (item) => item.classification === "exact_duplicate" && item.deletable
  );
  const estimated_reclaim_bytes = safe_delete_candidates.reduce(
    (sum, item) => sum + item.size_bytes,
    0
  );

  return {
    generated_at: new Date().toISOString(),
    bucket: PARTNER_DOCUMENTS_BUCKET,
    totals: {
      storage_files: storageObjects.length,
      storage_bytes: storageObjects.reduce((s, o) => s + o.size_bytes, 0),
      db_documents: dbDocuments.filter((d) => !d.deleted_at).length
    },
    by_classification: counts,
    by_document_type: Array.from(byTypeMap.entries())
      .map(([document_type, v]) => ({
        document_type,
        label: DOCUMENT_TYPE_LABEL[document_type] ?? document_type,
        count: v.count,
        bytes: v.bytes
      }))
      .sort((a, b) => b.bytes - a.bytes),
    items,
    safe_delete_candidates,
    estimated_reclaim_bytes
  };
}

export async function runPartnerDocumentsAudit(supabase: SupabaseClient): Promise<AuditSummary> {
  const [storageObjects, dbDocuments] = await Promise.all([
    listPartnerDocumentStorageObjects(supabase),
    fetchPartnerDocumentsForAudit(supabase)
  ]);
  return buildPartnerDocumentsAudit(storageObjects, dbDocuments);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
