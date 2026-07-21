import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { writeImportLog, deleteTempImportFile } from "@/lib/imports/import-logs";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type PartnerContactsDbRow,
  type PartnerContactsPartnerRow
} from "@/lib/imports/partner-contacts";
import { FULL_SYNC_IMPORT_TYPE } from "@/lib/imports/partner-contacts-sync";
import { commitPartnerContactsFullDb } from "@/lib/imports/partner-contacts-commit";
import {
  buildContactFullDbIdempotencyKey,
  cancelStaleImportJobs,
  completeImportJob,
  createImportJob,
  DuplicateImportJobError,
  findBlockingImportJob,
  hashContactImportPayload
} from "@/lib/imports/import-jobs";

const ContactRowSchema = z.object({
  row_number: z.number().int(),
  excluded: z.boolean(),
  excluded_reason: z.string().nullable(),
  partner_no: z.string().nullable().default(null),
  company_name: z.string(),
  normalized_company_name: z.string().nullable(),
  contract_date: z.string().nullable().default(null),
  grade: z.string().nullable().default(null),
  region_group: z.string().nullable().default(null),
  contact_name: z.string(),
  role_raw: z.string().nullable(),
  role_type: z.enum(["sales", "engineer", "admin", "executive", "contract", "etc"]),
  department: z.string().nullable(),
  position: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  is_contract_contact: z.boolean(),
  source_file: z.string(),
  warnings: z.array(z.string())
});

const ImportPayloadSchema = z.object({
  file_name: z.string().min(1),
  storage_path: z.string().nullable().optional(),
  rows: z.array(ContactRowSchema),
  file_hash: z.string().nullable().optional(),
  force_reprocess: z.boolean().optional().default(false)
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminClient();
  let importJobId: string | null = null;
  let parsedFileName: string | null = null;
  let parsedStoragePath: string | null = null;
  let parsedRowCount = 0;

  try {
    const json = await request.json();
    const parsed = ImportPayloadSchema.parse(json);
    parsedFileName = parsed.file_name;
    parsedStoragePath = parsed.storage_path ?? null;
    parsedRowCount = parsed.rows.length;

    const fileHash =
      parsed.file_hash?.trim() ||
      hashContactImportPayload(parsed.file_name, parsed.rows);
    const idempotencyKey = buildContactFullDbIdempotencyKey(fileHash);

    // stale processing job 자동 취소 (재실행하지 않음)
    const staleCancelled = await cancelStaleImportJobs(supabase, FULL_SYNC_IMPORT_TYPE).catch(
      () => 0
    );

    if (!parsed.force_reprocess) {
      const blocking = await findBlockingImportJob(supabase, idempotencyKey);
      if (blocking) {
        const processing =
          blocking.status === "processing" || blocking.status === "pending";
        return NextResponse.json(
          {
            ok: false,
            code: processing ? "IMPORT_IN_PROGRESS" : "IMPORT_ALREADY_DONE",
            message: processing
              ? "이미 처리 중인 파일입니다. 진행 상태를 확인하거나 취소 후 다시 시도하세요."
              : "이미 처리된 파일입니다. 재처리하려면 강제 재실행을 선택하세요.",
            import_job: blocking,
            stale_cancelled: staleCancelled
          },
          { status: 409 }
        );
      }
    }

    let importJob;
    try {
      // force 시에도 unique(processing) 충돌 방지: 키에 시각 접미사
      const jobKey = parsed.force_reprocess
        ? `${idempotencyKey}:force:${Date.now()}`
        : idempotencyKey;
      importJob = await createImportJob(supabase, {
        importType: FULL_SYNC_IMPORT_TYPE,
        fileName: parsed.file_name,
        totalRows: parsed.rows.length,
        idempotencyKey: jobKey,
        fileHash
      });
    } catch (error) {
      if (error instanceof DuplicateImportJobError) {
        return NextResponse.json(
          {
            ok: false,
            code: "IMPORT_DUPLICATE",
            message: error.message,
            import_job: error.existingJob,
            stale_cancelled: staleCancelled
          },
          { status: 409 }
        );
      }
      throw error;
    }

    importJobId = importJob.id;

    const [{ data: partners, error: partnerError }, { data: contacts, error: contactError }] =
      await Promise.all([
        supabase
          .from("partners")
          .select("id, company_name, external_no")
          .is("deleted_at", null),
        supabase
          .from("partner_contacts")
          .select(
            "id, partner_id, name, department, position, role_type, role_raw, email, phone, is_primary, is_contract_contact, is_active, in_current_full_db, deleted_at, merged_into_contact_id, review_required, review_reason, source_file, created_at"
          )
          .is("deleted_at", null)
          .is("merged_into_contact_id", null)
      ]);

    if (partnerError) throw new Error(partnerError.message);
    if (contactError) throw new Error(contactError.message);

    const commitResult = await commitPartnerContactsFullDb(supabase, {
      importJobId,
      rows: parsed.rows,
      partners: ((partners ?? []) as unknown) as PartnerContactsPartnerRow[],
      contacts: ((contacts ?? []) as unknown) as PartnerContactsDbRow[]
    });

    if (commitResult.cancelled) {
      const storageDeleted = await deleteTempImportFile(supabase, parsed.storage_path ?? null);
      await writeImportLog(supabase, {
        import_type: FULL_SYNC_IMPORT_TYPE,
        original_filename: parsed.file_name,
        total_rows: parsed.rows.length,
        success_count: commitResult.stats.created + commitResult.stats.updated + commitResult.stats.merged,
        failed_count: 0,
        review_count: commitResult.reviewCount,
        merge_count: commitResult.stats.merged,
        excluded_count: 0,
        storage_file_deleted: storageDeleted,
        storage_path: parsed.storage_path ?? null,
        status: "failed",
        error_message: "cancelled",
        import_job_id: importJobId,
        metadata: { cancelled: true, stale_cancelled: staleCancelled }
      });

      return NextResponse.json({
        ok: false,
        cancelled: true,
        message: "작업이 취소되었습니다. 기존 baseline은 유지됩니다.",
        import_job_id: importJobId,
        summary: {
          total: parsed.rows.length,
          created: commitResult.stats.created,
          updated: commitResult.stats.updated,
          merged: commitResult.stats.merged,
          skipped: commitResult.skippedCount,
          review: commitResult.reviewCount
        }
      });
    }

    const { stats, skippedCount, reviewCount, results, analysis } = commitResult;
    const finalStatus = reviewCount > 0 ? "completed_with_review" : "completed";

    await completeImportJob(supabase, importJobId, {
      status: finalStatus,
      createdCount: stats.created,
      updatedCount: stats.updated + stats.merged,
      skippedCount,
      reviewCount,
      processedRows: parsed.rows.length
    });

    const storageDeleted = await deleteTempImportFile(supabase, parsed.storage_path ?? null);

    await writeImportLog(supabase, {
      import_type: FULL_SYNC_IMPORT_TYPE,
      original_filename: parsed.file_name,
      total_rows: parsed.rows.length,
      success_count: stats.created + stats.updated + stats.merged,
      failed_count: 0,
      review_count: reviewCount,
      merge_count: stats.merged,
      excluded_count: stats.baseline_excluded,
      storage_file_deleted: storageDeleted,
      storage_path: parsed.storage_path ?? null,
      status: reviewCount > 0 ? "partial_success" : "success",
      import_job_id: importJobId,
      metadata: {
        current_baseline_count: stats.current_baseline_count,
        active_current_count: stats.active_current_count,
        emails_added: stats.emails_added,
        phones_added: stats.phones_added,
        roles_added: stats.roles_added,
        history_only_excluded: stats.history_only_excluded,
        corrected_count: stats.corrected_count,
        file_hash: fileHash,
        stale_cancelled: staleCancelled
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/contacts/review");
    revalidatePath("/dashboard/partners");
    revalidatePath("/dashboard/upload");

    return NextResponse.json({
      ok: true,
      import_job_id: importJobId,
      summary: {
        total: parsed.rows.length,
        current_baseline_count: stats.current_baseline_count,
        active_current_count: stats.active_current_count,
        created: stats.created,
        updated: stats.updated,
        merged: stats.merged,
        emails_added: stats.emails_added,
        phones_added: stats.phones_added,
        roles_added: stats.roles_added,
        baseline_excluded: stats.baseline_excluded,
        history_only_excluded: stats.history_only_excluded,
        corrected_count: stats.corrected_count,
        review_missing: stats.baseline_excluded,
        skipped: skippedCount,
        review: reviewCount,
        errors: 0
      },
      baselineExcluded: analysis.baselineExcluded,
      results
    });
  } catch (error) {
    if (importJobId) {
      await completeImportJob(supabase, importJobId, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "알 수 없는 오류"
      }).catch(() => undefined);
    }

    try {
      if (parsedFileName) {
        const storageDeleted = await deleteTempImportFile(supabase, parsedStoragePath);
        await writeImportLog(supabase, {
          import_type: FULL_SYNC_IMPORT_TYPE,
          original_filename: parsedFileName,
          total_rows: parsedRowCount,
          success_count: 0,
          failed_count: parsedRowCount,
          review_count: 0,
          merge_count: 0,
          excluded_count: 0,
          storage_file_deleted: storageDeleted,
          storage_path: parsedStoragePath,
          status: "failed",
          error_message: error instanceof Error ? error.message : "알 수 없는 오류",
          import_job_id: importJobId
        });
      }
    } catch {
      // import log 실패는 본 오류를 덮지 않음
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "담당자 업로드 저장에 실패했습니다.",
        import_job_id: importJobId
      },
      { status: 400 }
    );
  }
}
