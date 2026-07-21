import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import {
  computeFileHash,
  findCanonicalDocumentForType,
  purgeSupersededDocumentsForType,
  removeDocumentStorage,
  usesCanonicalTypeStorage
} from "@/lib/documents/document-lifecycle";
import {
  isSafeStorageObjectKey,
  resolveCanonicalUploadStoragePath,
  resolveUploadStoragePath
} from "@/lib/documents/storage-path";
import { isMultiDocumentAllowed } from "@/lib/documents/duplicate-detection";
import { resolveSaveAction } from "@/lib/imports/partner-documents";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentMatchSource, DocumentReviewStatus } from "@/lib/documents/constants";

const ParsedRowSchema = z.object({
  row_number: z.number().int(),
  client_key: z.string(),
  original_filename: z.string(),
  display_name: z.string(),
  relative_path: z.string(),
  source_folder: z.string(),
  source_folder_name: z.string().nullable().optional(),
  folder_match_candidates: z.array(z.string()).optional().default([]),
  folder_normalized_name: z.string().nullable().optional(),
  is_generic_folder: z.boolean().optional().default(false),
  filename_partner_name: z.string().nullable().optional(),
  filename_partner_candidates: z.array(z.string()).optional().default([]),
  source_file: z.string(),
  file_ext: z.string(),
  file_size: z.number(),
  document_type: z.string(),
  partner_name_raw: z.string().nullable(),
  partner_name_source: z.enum(["folder", "filename"]).nullable(),
  normalized_company_name: z.string().nullable(),
  contract_date: z.string().nullable(),
  received_date: z.string().nullable(),
  partner_no: z.string().nullable(),
  grade_from_file: z.string().nullable(),
  period_year: z.number().nullable(),
  period_quarter: z.string().nullable(),
  period_month: z.number().nullable(),
  note: z.string().nullable(),
  extracted_partner_name: z.string().nullable(),
  matched_partner_id: z.string().nullable(),
  matched_partner_name: z.string().nullable(),
  match_source: z.enum(["folder", "filename", "partner_no", "fuzzy", "manual"]).nullable(),
  match_status: z.enum(["matched", "needs_review", "unmatched"]),
  match_method: z.enum(["exact", "alias", "includes", "fuzzy", "manual", "folder"]).nullable(),
  match_confidence: z.number(),
  review_status: z.enum(["auto_matched", "needs_review", "skipped"]),
  save_enabled: z.boolean(),
  action: z.enum(["create", "update", "skip", "review"]),
  is_primary: z.boolean(),
  priority_score: z.number(),
  matched_document_id: z.string().nullable(),
  suggested_partner_id: z.string().nullable().optional(),
  suggested_partner_name: z.string().nullable().optional(),
  suggested_partner_confidence: z.number().optional().default(0),
  partner_edit_source: z.enum(["auto", "manual", "folder_bulk", "suggested"]).nullable().optional(),
  already_registered: z.boolean().optional().default(false),
  save_as_new_version: z.boolean().optional().default(false),
  reason: z.string()
});

type ParsedRow = z.infer<typeof ParsedRowSchema>;

type ExistingDocumentRow = {
  id: string;
  storage_path: string | null;
  file_path: string | null;
  file_hash?: string | null;
};

export async function POST(request: Request) {
  // TODO(auth): 추후 admin 세션 도입 시 requireAdmin() 복원. 현재는 service role로 처리.
  const supabase = createAdminClient();
  let importJobId: string | null = null;

  try {
    const formData = await request.formData();
    const metadataRaw = formData.get("metadata");
    const batchName = String(formData.get("batch_name") ?? "partner-documents-upload");
    if (!metadataRaw) throw new Error("metadata가 없습니다.");

    const rows = z.array(ParsedRowSchema).parse(JSON.parse(String(metadataRaw)));
    const saveTargets = rows
      .map((row) => ({ row, saveAction: resolveSaveAction(row) }))
      .filter(
        (entry): entry is { row: ParsedRow; saveAction: "create" | "update" } =>
          entry.saveAction != null
      );

    await ensurePartnerDocumentsBucket(supabase);

    const { data: importJob, error: importJobError } = await supabase
      .from("import_jobs")
      .insert({
        import_type: "partner_documents",
        file_name: batchName,
        status: "processing",
        total_rows: rows.length,
        created_count: 0,
        updated_count: 0,
        skipped_count: 0,
        review_count: 0
      })
      .select("id")
      .single();

    if (importJobError || !importJob) {
      throw new Error(importJobError?.message ?? "import job 생성 실패");
    }
    importJobId = importJob.id as string;

    let createdCount = 0;
    let updatedCount = 0;
    let storageSuccessCount = 0;
    let dbSuccessCount = 0;
    const needsReviewCount = rows.filter((row) => row.review_status === "needs_review").length;
    let skippedCount = rows.filter((row) => row.review_status === "skipped").length;
    let failedCount = 0;
    const affectedGroups = new Set<string>();
    const affectedPartnerIds = new Set<string>();
    const failures: Array<{ row_number: number; filename: string; message: string }> = [];

    for (const { row, saveAction } of saveTargets) {
      const file = formData.get(`file_${row.row_number}`);
      if (!(file instanceof File)) {
        skippedCount += 1;
        failedCount += 1;
        failures.push({
          row_number: row.row_number,
          filename: row.original_filename,
          message: "업로드 파일을 찾을 수 없습니다."
        });
        continue;
      }

      const partnerId = row.matched_partner_id!;
      const useCanonical = usesCanonicalTypeStorage(row.document_type, row.original_filename);
      const existingDocument = await findExistingDocument(
        supabase,
        partnerId,
        row.document_type,
        row.original_filename,
        row.matched_document_id,
        useCanonical
      );
      const documentId = existingDocument?.id ?? row.matched_document_id;
      const resolvedSaveAction: "create" | "update" =
        useCanonical || saveAction === "update" || documentId ? "update" : "create";

      const previousStoragePath = pickSafePreviousPath(existingDocument);

      const buffer = Buffer.from(await file.arrayBuffer());
      const fileHash = computeFileHash(buffer);

      if (existingDocument?.file_hash === fileHash) {
        skippedCount += 1;
        continue;
      }

      const storagePath = useCanonical
        ? resolveCanonicalUploadStoragePath(
            partnerId,
            row.document_type,
            row.file_ext,
            row.original_filename,
            existingDocument?.storage_path,
            existingDocument?.file_path,
            true
          )
        : resolveUploadStoragePath(
            partnerId,
            row.document_type,
            row.file_ext,
            row.original_filename,
            existingDocument?.storage_path,
            existingDocument?.file_path
          );

      if (!isSafeStorageObjectKey(storagePath)) {
        skippedCount += 1;
        failedCount += 1;
        failures.push({
          row_number: row.row_number,
          filename: row.original_filename,
          message: "안전한 Storage 경로를 생성하지 못했습니다."
        });
        continue;
      }

      const uploadError = await uploadDocumentFile(supabase, storagePath, buffer, file.type);
      if (uploadError) {
        skippedCount += 1;
        failedCount += 1;
        failures.push({
          row_number: row.row_number,
          filename: row.original_filename,
          message: uploadError
        });
        continue;
      }
      storageSuccessCount += 1;

      const payload = buildDocumentPayload(row, partnerId, storagePath, batchName, fileHash);
      let savedDocumentId = documentId;

      if (resolvedSaveAction === "update" && documentId) {
        const { error } = await supabase
          .from("partner_documents")
          .update(payload)
          .eq("id", documentId);

        if (error) {
          skippedCount += 1;
          failedCount += 1;
          failures.push({
            row_number: row.row_number,
            filename: row.original_filename,
            message: error.message
          });
          continue;
        }

        if (previousStoragePath && previousStoragePath !== storagePath) {
          const removed = await removeDocumentStorage(supabase, previousStoragePath);
          if (!removed.ok) {
            console.error("[document-upload] old storage delete failed", {
              documentId,
              path: previousStoragePath,
              error: removed.error
            });
          }
        }

        updatedCount += 1;
        dbSuccessCount += 1;
      } else {
        const { data: inserted, error } = await supabase
          .from("partner_documents")
          .insert(payload)
          .select("id")
          .single();

        if (error) {
          if (error.code === "23505") {
            const duplicate = await findExistingDocument(
              supabase,
              partnerId,
              row.document_type,
              row.original_filename,
              null,
              useCanonical
            );
            if (duplicate?.id) {
              const { error: updateError } = await supabase
                .from("partner_documents")
                .update(payload)
                .eq("id", duplicate.id);
              if (updateError) {
                skippedCount += 1;
                failedCount += 1;
                failures.push({
                  row_number: row.row_number,
                  filename: row.original_filename,
                  message: updateError.message
                });
                continue;
              }
              savedDocumentId = duplicate.id;
              updatedCount += 1;
              dbSuccessCount += 1;
            } else {
              skippedCount += 1;
              failedCount += 1;
              failures.push({
                row_number: row.row_number,
                filename: row.original_filename,
                message: error.message
              });
              continue;
            }
          } else {
            skippedCount += 1;
            failedCount += 1;
            failures.push({
              row_number: row.row_number,
              filename: row.original_filename,
              message: error.message
            });
            continue;
          }
        } else {
          savedDocumentId = inserted?.id as string;
          createdCount += 1;
          dbSuccessCount += 1;
        }
      }

      if (useCanonical && savedDocumentId && !isMultiDocumentAllowed(row)) {
        const purged = await purgeSupersededDocumentsForType(
          supabase,
          partnerId,
          row.document_type,
          savedDocumentId
        );
        if (purged.errors.length > 0) {
          console.error("[document-upload] purge superseded", {
            partnerId,
            documentType: row.document_type,
            keepId: savedDocumentId,
            errors: purged.errors
          });
        }
      }

      affectedGroups.add(`${partnerId}:${row.document_type}`);
      affectedPartnerIds.add(partnerId);
    }

    for (const groupKey of affectedGroups) {
      const [partnerId, documentType] = groupKey.split(":");
      await refreshPrimaryDocument(supabase, partnerId, documentType);
    }

    const status =
      dbSuccessCount === 0 && saveTargets.length > 0 ? "failed" : "completed";

    await supabase
      .from("import_jobs")
      .update({
        status,
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        review_count: needsReviewCount
      })
      .eq("id", importJobId);

    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard/upload");
    revalidatePath("/dashboard/partners", "layout");
    for (const partnerId of affectedPartnerIds) {
      revalidatePath(`/dashboard/partners/${partnerId}`);
    }

    return NextResponse.json({
      ok: dbSuccessCount > 0 || saveTargets.length === 0,
      summary: {
        total: rows.length,
        storage_success: storageSuccessCount,
        db_success: dbSuccessCount,
        success: dbSuccessCount,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        needs_review: needsReviewCount,
        failed: failedCount
      },
      failures
    });
  } catch (error) {
    if (importJobId) {
      await supabase.from("import_jobs").update({ status: "failed" }).eq("id", importJobId);
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "문서 업로드 실패"
      },
      { status: 400 }
    );
  }
}

async function ensurePartnerDocumentsBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(
      `Storage bucket 목록을 확인할 수 없습니다. Supabase Storage 설정을 확인하세요. (${listError.message})`
    );
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === PARTNER_DOCUMENTS_BUCKET);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(PARTNER_DOCUMENTS_BUCKET, {
    public: false
  });

  if (createError) {
    throw new Error(
      "Supabase Storage에 partner-documents bucket이 없습니다. bucket을 먼저 생성해 주세요."
    );
  }
}

async function findExistingDocument(
  supabase: ReturnType<typeof createAdminClient>,
  partnerId: string,
  documentType: string,
  originalFilename: string,
  matchedDocumentId: string | null,
  useCanonical: boolean
): Promise<ExistingDocumentRow | null> {
  if (matchedDocumentId) {
    const { data } = await supabase
      .from("partner_documents")
      .select("id, storage_path, file_path, file_hash")
      .eq("id", matchedDocumentId)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) return data as ExistingDocumentRow;
  }

  if (useCanonical) {
    const canonical = await findCanonicalDocumentForType(supabase, partnerId, documentType);
    if (canonical) {
      return {
        id: canonical.id,
        storage_path: canonical.storage_path,
        file_path: canonical.file_path,
        file_hash: canonical.file_hash ?? null
      };
    }
    return null;
  }

  const { data } = await supabase
    .from("partner_documents")
    .select("id, storage_path, file_path, file_hash")
    .eq("partner_id", partnerId)
    .eq("document_type", documentType)
    .eq("original_filename", originalFilename)
    .eq("is_active", true)
    .eq("is_duplicate", false)
    .is("deleted_at", null)
    .maybeSingle();

  return (data as ExistingDocumentRow | null) ?? null;
}

function pickSafePreviousPath(existing: ExistingDocumentRow | null): string | null {
  if (!existing) return null;
  const candidate = existing.storage_path ?? existing.file_path;
  if (candidate && isSafeStorageObjectKey(candidate)) {
    return candidate;
  }
  return null;
}

async function uploadDocumentFile(
  supabase: ReturnType<typeof createAdminClient>,
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  if (!isSafeStorageObjectKey(storagePath)) {
    return "Storage 경로에 허용되지 않는 문자가 포함되어 있습니다.";
  }

  const { error } = await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).upload(storagePath, buffer, {
    upsert: true,
    contentType: contentType || "application/octet-stream"
  });

  return error?.message ?? null;
}

function buildDocumentPayload(
  row: ParsedRow,
  partnerId: string,
  storagePath: string,
  batchName: string,
  fileHash: string
) {
  const displayName = row.display_name.trim() || row.original_filename;
  const reviewStatus: DocumentReviewStatus =
    row.match_status === "matched" ? "auto_matched" : row.review_status === "skipped" ? "auto_matched" : "needs_review";

  return {
    partner_id: partnerId,
    partner_name_raw: row.extracted_partner_name ?? row.partner_name_raw,
    extracted_partner_name: row.extracted_partner_name ?? row.partner_name_raw,
    document_type: row.document_type,
    document_status: "active",
    original_filename: row.original_filename,
    display_name: displayName,
    file_name: displayName,
    file_path: storagePath,
    storage_path: storagePath,
    file_ext: row.file_ext,
    file_size: row.file_size,
    file_hash: fileHash,
    source_folder: row.source_folder,
    source_file: row.source_file,
    received_date: row.received_date,
    contract_date: row.contract_date,
    partner_no: row.partner_no,
    grade_from_file: row.grade_from_file,
    period_year: row.period_year,
    period_quarter: row.period_quarter,
    period_month: row.period_month,
    is_primary: true,
    priority_score: row.priority_score,
    is_active: true,
    is_duplicate: false,
    duplicate_of: null,
    duplicate_reason: null,
    representative: true,
    upload_batch_id: batchName,
    match_source: row.match_source as DocumentMatchSource | null,
    match_status: row.match_status,
    match_method: row.match_method,
    match_confidence: row.match_confidence,
    review_status: reviewStatus,
    note: row.reason ?? row.note,
    uploaded_by: "upload-portal",
    summary: row.note,
    deleted_at: null,
    archived_at: null,
    archived_reason: null
  };
}

async function refreshPrimaryDocument(
  supabase: ReturnType<typeof createAdminClient>,
  partnerId: string,
  documentType: string
) {
  const { data, error } = await supabase
    .from("partner_documents")
    .select("id, priority_score")
    .eq("partner_id", partnerId)
    .eq("document_type", documentType)
    .eq("is_active", true)
    .eq("is_duplicate", false)
    .is("deleted_at", null);

  if (error || !data || data.length === 0) return;

  const sorted = [...data].sort(
    (left, right) => (right.priority_score ?? 0) - (left.priority_score ?? 0)
  );
  const primaryId = sorted[0]?.id;
  if (!primaryId) return;

  await supabase
    .from("partner_documents")
    .update({ is_primary: false, representative: false })
    .eq("partner_id", partnerId)
    .eq("document_type", documentType)
    .is("deleted_at", null);

  await supabase
    .from("partner_documents")
    .update({ is_primary: true, representative: true })
    .eq("id", primaryId);
}
