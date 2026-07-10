import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { syncContactDetails } from "@/lib/contacts/contact-details";
import { mergeContactsIntoMaster } from "@/lib/contacts/contact-merge";
import { buildPersonKey } from "@/lib/contacts/person-key";
import { writeImportLog, deleteTempImportFile } from "@/lib/imports/import-logs";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  activateBaselineContacts,
  countActiveBaselineContacts,
  excludeContactsNotInBaseline
} from "@/lib/imports/contact-baseline";
import {
  analyzePartnerContactRows,
  isEducationOrEventOnlyContact,
  type PartnerContactsDbRow,
  type PartnerContactsPartnerRow
} from "@/lib/imports/partner-contacts";
import {
  applySanitizedEmailPhoneToPayload,
  buildBaselineResetStartPayload,
  buildContactUpsertPayload,
  buildRoleLabelsFromImportRow,
  emptyImportStats,
  FULL_SYNC_IMPORT_TYPE
} from "@/lib/imports/partner-contacts-sync";
import {
  normalizeSanitizedContactFields,
  sanitizeContactEmailPhone
} from "@/lib/contacts/contact-field-sanitize";

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
  rows: z.array(ContactRowSchema)
});

type ImportRow = z.infer<typeof ContactRowSchema>;

type RowResult = {
  company_name: string;
  contact_name: string;
  status:
    | "created"
    | "updated"
    | "merged"
    | "skipped"
    | "review"
    | "baseline_excluded";
  partner_id: string | null;
  message: string | null;
};

export async function POST(request: Request) {
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
    const stats = emptyImportStats();
    const baselinePersonKeys = new Set<string>();
    const syncedContactIds = new Set<string>();
    const reviewRequiredIds = new Set<string>();

    const { data: importJob, error: importJobError } = await supabase
      .from("import_jobs")
      .insert({
        import_type: FULL_SYNC_IMPORT_TYPE,
        file_name: parsed.file_name,
        status: "processing",
        total_rows: parsed.rows.length,
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

    const contactRows = (contacts ?? []) as unknown as PartnerContactsDbRow[];

    const { error: resetError } = await supabase
      .from("partner_contacts")
      .update(buildBaselineResetStartPayload())
      .is("deleted_at", null)
      .is("merged_into_contact_id", null);
    if (resetError) throw new Error(resetError.message);

    const analysis = analyzePartnerContactRows(
      parsed.rows,
      ((partners ?? []) as unknown) as PartnerContactsPartnerRow[],
      contactRows
    );
    const analysisMap = new Map(analysis.items.map((item) => [item.row_number, item]));

    let skippedCount = 0;
    let reviewCount = 0;
    const results: RowResult[] = [];

    for (const row of parsed.rows) {
      const item = analysisMap.get(row.row_number);
      if (!item) continue;

      if (item.action === "skip") {
        skippedCount += 1;
        results.push(rowResult(row, "skipped", null, item.reason));
        continue;
      }

      if (item.action === "review" || item.action === "duplicate") {
        reviewCount += 1;
        await enqueueReview(supabase, importJobId, row, item.reason);
        results.push(rowResult(row, "review", item.matched_partner_id, item.reason));
        continue;
      }

      if (!item.matched_partner_id) {
        throw new Error("담당자 저장 대상 partner_id가 없습니다.");
      }

      const importRow = toImportRow(row);
      let contactId = item.matched_contact_id;

      if (item.action === "create") {
        const payload = buildContactUpsertPayload({
          row: importRow,
          matchConfidence: item.match_confidence,
          matchMethod: item.match_method
        });
        const fieldResult = applySanitizedEmailPhoneToPayload(payload, row.email, row.phone);
        if (fieldResult.corrected) stats.corrected_count += 1;

        const { data: created, error } = await supabase
          .from("partner_contacts")
          .insert({ ...payload, partner_id: item.matched_partner_id })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        contactId = created?.id as string;
        if (fieldResult.needsReview && contactId) reviewRequiredIds.add(contactId);
        stats.created += 1;
        results.push(rowResult(row, "created", item.matched_partner_id, item.reason));
      } else if (contactId) {
        const payload = buildContactUpsertPayload({
          row: importRow,
          existingContact: contactRows.find((c) => c.id === contactId),
          matchConfidence: item.match_confidence,
          matchMethod: item.match_method
        });
        const fieldResult = applySanitizedEmailPhoneToPayload(payload, row.email, row.phone);
        if (fieldResult.corrected) stats.corrected_count += 1;

        const { error } = await supabase
          .from("partner_contacts")
          .update(payload)
          .eq("id", contactId);
        if (error) throw new Error(error.message);
        if (fieldResult.needsReview) reviewRequiredIds.add(contactId);

        if (item.review_duplicate && contactId) {
          const duplicateReviewReason =
            item.reason.includes("수동 확인") ? item.reason : "중복 후보 수동 확인 필요";
          const idsToReview = [contactId, ...item.manual_duplicate_ids];
          for (const reviewId of idsToReview) {
            reviewRequiredIds.add(reviewId);
          }
          await supabase
            .from("partner_contacts")
            .update({
              review_required: true,
              review_reason: duplicateReviewReason
            })
            .in("id", idsToReview);
        }

        if (item.action === "merge" && item.merge_contact_ids.length > 0) {
          const mergeResult = await mergeContactsIntoMaster(
            supabase,
            contactId,
            item.merge_contact_ids,
            row.source_file
          );
          stats.merged += mergeResult.merged_ids.length;
          for (const mergedId of mergeResult.merged_ids) {
            syncedContactIds.add(mergedId);
          }
          results.push(
            rowResult(
              row,
              "merged",
              item.matched_partner_id,
              `${item.reason} (${mergeResult.merged_ids.length}건 병합)`
            )
          );
        } else {
          stats.updated += 1;
          results.push(rowResult(row, "updated", item.matched_partner_id, item.reason));
        }
      }

      if (contactId && item.matched_partner_id) {
        syncedContactIds.add(contactId);
        for (const dupId of item.manual_duplicate_ids) {
          syncedContactIds.add(dupId);
        }
        baselinePersonKeys.add(buildPersonKey(item.matched_partner_id, item.contact_name));

        const sanitizedFields = normalizeSanitizedContactFields(
          sanitizeContactEmailPhone({ email: row.email, phone: row.phone })
        );

        const detailStats = await syncContactDetails(supabase, {
          contact_id: contactId,
          email: sanitizedFields.email,
          phone: sanitizedFields.phone,
          role_labels: buildRoleLabelsFromImportRow(importRow),
          source: row.source_file,
          prefer_upload_email_as_primary: Boolean(row.email),
          prefer_upload_phone_as_primary: Boolean(row.phone)
        });
        stats.emails_added += detailStats.emails_added;
        stats.phones_added += detailStats.phones_added;
        stats.roles_added += detailStats.roles_added;
      }
    }

    if (syncedContactIds.size === 0) {
      throw new Error(
        "전체DB baseline reset 실패: 저장된 contact가 0건입니다. 파트너 매칭/분석 결과를 확인하세요."
      );
    }

    await activateBaselineContacts(supabase, [...syncedContactIds], reviewRequiredIds);

    const excludedRows = await excludeContactsNotInBaseline(supabase, syncedContactIds);
    stats.baseline_excluded = excludedRows.length;

    const excludedIds = excludedRows.map((row) => row.id);
    const historyOnlyFromSource = excludedRows.filter((row) =>
      isEducationOrEventOnlyContact(row as PartnerContactsDbRow)
    ).length;

    let historyOnlyFromTraining = 0;
    if (excludedIds.length > 0) {
      const { data: trainingLinks } = await supabase
        .from("training_attendance")
        .select("contact_id")
        .in("contact_id", excludedIds)
        .not("contact_id", "is", null);

      historyOnlyFromTraining = new Set(
        (trainingLinks ?? []).map((row) => row.contact_id as string)
      ).size;
    }

    stats.history_only_excluded = Math.max(historyOnlyFromSource, historyOnlyFromTraining);
    stats.current_baseline_count = baselinePersonKeys.size;
    stats.active_current_count = await countActiveBaselineContacts(supabase);

    if (stats.active_current_count === 0) {
      throw new Error(
        `baseline reset 오류: 처리 contact ${syncedContactIds.size}건이지만 active/current contact가 0명입니다. migration 033·034(in_current_full_db, contact_source) 적용 여부를 확인하세요.`
      );
    }

    for (const excluded of analysis.baselineExcluded) {
      results.push({
        company_name: excluded.partner_name,
        contact_name: excluded.contact_name,
        status: "baseline_excluded",
        partner_id: excluded.partner_id,
        message: excluded.reason
      });
    }

    const finalStatus = reviewCount > 0 ? "completed_with_review" : "completed";

    await supabase
      .from("import_jobs")
      .update({
        status: finalStatus,
        created_count: stats.created,
        updated_count: stats.updated + stats.merged,
        skipped_count: skippedCount,
        review_count: reviewCount
      })
      .eq("id", importJobId);

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
        corrected_count: stats.corrected_count
      }
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/contacts/review");
    revalidatePath("/dashboard/partners");
    revalidatePath("/dashboard/upload");

    return NextResponse.json({
      ok: true,
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
      await supabase
        .from("import_jobs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "알 수 없는 오류"
        })
        .eq("id", importJobId);
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
        message: error instanceof Error ? error.message : "담당자 업로드 저장에 실패했습니다."
      },
      { status: 400 }
    );
  }
}

function toImportRow(row: ImportRow) {
  return {
    contact_name: row.contact_name,
    role_raw: row.role_raw,
    role_type: row.role_type,
    department: row.department,
    position: row.position,
    phone: row.phone,
    email: row.email,
    is_contract_contact: row.is_contract_contact,
    source_file: row.source_file
  };
}

function rowResult(
  row: ImportRow,
  status: RowResult["status"],
  partnerId: string | null,
  message: string
): RowResult {
  return {
    company_name: row.company_name,
    contact_name: row.contact_name,
    status,
    partner_id: partnerId,
    message
  };
}

async function enqueueReview(
  supabase: ReturnType<typeof createAdminClient>,
  importJobId: string,
  row: ImportRow,
  reason: string
) {
  const { error } = await supabase.from("import_review_queue").insert({
    import_job_id: importJobId,
    import_type: FULL_SYNC_IMPORT_TYPE,
    row_number: row.row_number,
    company_name: row.company_name,
    reason,
    raw_data: row,
    status: "pending"
  });
  if (error) throw new Error(error.message);
}
