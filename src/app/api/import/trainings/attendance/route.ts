import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteTempImportFile, writeImportLog } from "@/lib/imports/import-logs";
import {
  analyzeTrainingAttendanceRows,
  type ExistingTrainingAttendanceRow,
  type TrainingAttendancePartnerRow,
  type TrainingMasterRow
} from "@/lib/imports/training-attendance-detail";
import {
  TrainingAttendanceImportSchema,
  type TrainingAttendanceImportRow
} from "@/lib/imports/training-attendance-schemas";
import {
  buildContactFillEmptyPatch,
  buildReferenceContactInsert,
  findContactForTrainingSync,
  hasContactSyncData,
  type PartnerContactRow,
  type TrainingContactSyncInput
} from "@/lib/imports/training-attendance-contact-sync";
import { normalizeCompanyName } from "@/lib/partner-match";
import {
  buildAttendancePayload,
  buildTrainingFillEmptyPatch,
  buildTrainingInsertPayload
} from "@/lib/training/payloads";
import type { ParsedTrainingAttendanceRow } from "@/lib/excel/parse-training-attendance-detail";

type ImportRow = TrainingAttendanceImportRow;

type RowResult = {
  company_name: string;
  attendee_name: string;
  training_name: string;
  status: "created" | "updated" | "skipped" | "review";
  partner_id: string | null;
  training_id: string | null;
  attendance_id: string | null;
  message: string | null;
};

export async function POST(request: Request) {
  const supabase = createAdminClient();
  let importJobId: string | null = null;
  let parsedFileName: string | null = null;
  let parsedStoragePath: string | null = null;

  try {
    const json = await request.json();
    const parsed = TrainingAttendanceImportSchema.parse(json);
    parsedFileName = parsed.file_name;
    parsedStoragePath = parsed.storage_path ?? null;

    const { data: importJob, error: importJobError } = await supabase
      .from("import_jobs")
      .insert({
        import_type: "education_attendee_upload",
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

    const [
      { data: partners, error: partnerError },
      { data: trainings, error: trainingError },
      { data: attendances, error: attendanceError },
      { data: contacts, error: contactsError }
    ] = await Promise.all([
      supabase.from("partners").select("id, company_name"),
      supabase
        .from("trainings")
        .select(
          "id, training_name, training_type, training_level, product, product_name, session_name, start_date, training_year, training_month"
        ),
      supabase
        .from("training_attendance")
        .select("id, partner_id, training_id, attendee_name"),
      supabase
        .from("partner_contacts")
        .select("id, partner_id, name, department, position, email, phone, memo")
    ]);

    if (partnerError) throw new Error(partnerError.message);
    if (trainingError) throw new Error(trainingError.message);
    if (attendanceError) throw new Error(attendanceError.message);
    if (contactsError) throw new Error(contactsError.message);

    const analysis = analyzeTrainingAttendanceRows(
      parsed.rows,
      ((partners ?? []) as unknown) as TrainingAttendancePartnerRow[],
      ((trainings ?? []) as unknown) as TrainingMasterRow[],
      ((attendances ?? []) as unknown) as ExistingTrainingAttendanceRow[]
    );
    const analysisMap = new Map(analysis.items.map((item) => [item.row_number, item]));

    const partnerByNormalized = new Map<string, TrainingAttendancePartnerRow>();
    for (const partner of (partners ?? []) as TrainingAttendancePartnerRow[]) {
      const key = normalizeCompanyName(partner.company_name);
      if (key && !partnerByNormalized.has(key)) {
        partnerByNormalized.set(key, partner);
      }
    }

    const trainingCache = new Map(
      ((trainings ?? []) as TrainingMasterRow[]).map((training) => [
        getTrainingKey(
          training.training_name,
          training.training_year,
          training.training_month,
          training.start_date
        ),
        training
      ])
    );
    const attendanceCache = new Map(
      ((attendances ?? []) as ExistingTrainingAttendanceRow[]).map((attendance) => [
        `${attendance.partner_id}|${attendance.training_id}|${normalizeName(attendance.attendee_name)}`,
        attendance
      ])
    );
    const contactRows = ((contacts ?? []) as PartnerContactRow[]).slice();

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let reviewCount = 0;
    let createdTrainingCount = 0;
    let createdAttendanceCount = 0;
    const results: RowResult[] = [];
    const reviewRows: Array<{ row: ImportRow; reason: string }> = [];

    for (const row of parsed.rows) {
      const item = analysisMap.get(row.row_number);
      if (!item) continue;

      if (item.action === "skip") {
        skippedCount += 1;
        results.push({
          company_name: row.company_name,
          attendee_name: row.attendee_name,
          training_name: row.training_name,
          status: "skipped",
          partner_id: null,
          training_id: null,
          attendance_id: null,
          message: item.reason
        });
        continue;
      }

      const partnerKey = normalizeCompanyName(row.company_name);
      const partner = partnerKey ? partnerByNormalized.get(partnerKey) : undefined;
      if (!partner || item.matched_partner_id !== partner.id) {
        reviewCount += 1;
        reviewRows.push({ row, reason: item.reason });
        results.push({
          company_name: row.company_name,
          attendee_name: row.attendee_name,
          training_name: row.training_name,
          status: "review",
          partner_id: item.matched_partner_id,
          training_id: item.matched_training_id,
          attendance_id: item.matched_attendance_id,
          message: item.reason
        });
        continue;
      }

      let trainingId = item.matched_training_id;
      const trainingKey = getTrainingKey(
        row.training_name,
        row.training_year,
        row.training_month,
        row.start_date
      );
      const existingTraining = trainingCache.get(trainingKey);

      if (!existingTraining && item.action === "create" && item.new_training) {
        const { data: createdTraining, error: createTrainingError } = await supabase
          .from("trainings")
          .insert(buildTrainingInsertPayload(asParsedRow(row)))
          .select(
            "id, training_name, training_type, training_level, product, product_name, session_name, start_date, training_year, training_month"
          )
          .single();
        if (createTrainingError || !createdTraining) {
          throw new Error(createTrainingError?.message ?? "교육 생성 실패");
        }
        trainingId = createdTraining.id as string;
        trainingCache.set(trainingKey, createdTraining as TrainingMasterRow);
        createdTrainingCount += 1;
        createdCount += 1;
      } else if (!trainingId && existingTraining) {
        trainingId = existingTraining.id;
      }

      if (!trainingId) {
        reviewCount += 1;
        reviewRows.push({ row, reason: "교육을 찾지 못했습니다." });
        results.push({
          company_name: row.company_name,
          attendee_name: row.attendee_name,
          training_name: row.training_name,
          status: "review",
          partner_id: partner.id,
          training_id: null,
          attendance_id: null,
          message: "교육을 찾지 못했습니다."
        });
        continue;
      }

      await patchTrainingMetadata(supabase, trainingId, row);

      const attendanceKey = `${partner.id}|${trainingId}|${normalizeName(row.attendee_name)}`;
      const existingAttendance = attendanceCache.get(attendanceKey);
      const payload = buildAttendancePayload(asParsedRow(row), partner.id, trainingId);

      if (existingAttendance) {
        const { error } = await supabase
          .from("training_attendance")
          .update(payload)
          .eq("id", existingAttendance.id);
        if (error) {
          throw new Error(error.message);
        }
        await syncPartnerContactFromTrainingRow(supabase, contactRows, row, partner.id);
        updatedCount += 1;
        results.push({
          company_name: row.company_name,
          attendee_name: row.attendee_name,
          training_name: row.training_name,
          status: "updated",
          partner_id: partner.id,
          training_id: trainingId,
          attendance_id: existingAttendance.id,
          message: item.reason
        });
        continue;
      }

      const { data: createdAttendance, error: createAttendanceError } = await supabase
        .from("training_attendance")
        .insert(payload)
        .select("id")
        .single();
      if (createAttendanceError || !createdAttendance) {
        throw new Error(createAttendanceError?.message ?? "참석자 생성 실패");
      }

      await syncPartnerContactFromTrainingRow(supabase, contactRows, row, partner.id);

      attendanceCache.set(attendanceKey, {
        id: createdAttendance.id as string,
        partner_id: partner.id,
        training_id: trainingId,
        attendee_name: row.attendee_name
      });
      createdAttendanceCount += 1;
      createdCount += 1;
      results.push({
        company_name: row.company_name,
        attendee_name: row.attendee_name,
        training_name: row.training_name,
        status: "created",
        partner_id: partner.id,
        training_id: trainingId,
        attendance_id: createdAttendance.id as string,
        message: item.reason
      });
    }

    for (const reviewRow of reviewRows) {
      const { error } = await supabase.from("import_review_queue").insert({
        import_job_id: importJobId,
        import_type: "education_attendee_upload",
        row_number: reviewRow.row.row_number,
        company_name: reviewRow.row.company_name,
        reason: reviewRow.reason,
        raw_data: reviewRow.row,
        status: "pending"
      });
      if (error) {
        throw new Error(error.message);
      }
    }

    const finalStatus = reviewCount > 0 ? "completed_with_review" : "completed";

    const { error: updateJobError } = await supabase
      .from("import_jobs")
      .update({
        status: finalStatus,
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        review_count: reviewCount,
        error_message: null
      })
      .eq("id", importJobId);
    if (updateJobError) throw new Error(updateJobError.message);

    const storageDeleted = await deleteTempImportFile(supabase, parsed.storage_path ?? null);

    await writeImportLog(supabase, {
      import_type: "education_attendee_upload",
      original_filename: parsed.file_name,
      total_rows: parsed.rows.length,
      success_count: createdCount + updatedCount,
      failed_count: 0,
      review_count: reviewCount,
      merge_count: 0,
      excluded_count: skippedCount,
      storage_file_deleted: storageDeleted,
      storage_path: parsed.storage_path ?? null,
      status: reviewCount > 0 ? "partial_success" : "success",
      import_job_id: importJobId
    });

    revalidatePath("/dashboard/trainings");
    revalidatePath("/dashboard/partners");
    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/upload");

    return NextResponse.json({
      ok: true,
      summary: {
        total: parsed.rows.length,
        created: createdCount,
        created_trainings: createdTrainingCount,
        created_attendees: createdAttendanceCount,
        updated: updatedCount,
        skipped: skippedCount,
        review: reviewCount,
        errors: 0
      },
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

    if (parsedStoragePath) {
      await deleteTempImportFile(supabase, parsedStoragePath);
      if (parsedFileName) {
        await writeImportLog(supabase, {
          import_type: "education_attendee_upload",
          original_filename: parsedFileName,
          total_rows: 0,
          success_count: 0,
          failed_count: 1,
          review_count: 0,
          merge_count: 0,
          excluded_count: 0,
          storage_file_deleted: true,
          storage_path: parsedStoragePath,
          status: "failed",
          error_message: error instanceof Error ? error.message : "저장 실패",
          import_job_id: importJobId
        });
      }
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "정기교육 참석자 업로드 저장에 실패했습니다."
      },
      { status: 400 }
    );
  }
}

function asParsedRow(row: ImportRow): ParsedTrainingAttendanceRow {
  return row as ParsedTrainingAttendanceRow;
}

async function patchTrainingMetadata(
  supabase: ReturnType<typeof createAdminClient>,
  trainingId: string,
  row: ImportRow
): Promise<void> {
  const patch = buildTrainingFillEmptyPatch(asParsedRow(row));
  if (!patch) return;

  const { error } = await supabase.from("trainings").update(patch).eq("id", trainingId);
  if (error) throw new Error(error.message);
}

function getTrainingKey(
  trainingName: string,
  trainingYear: number | null,
  trainingMonth: number | null,
  startDate?: string | null
): string {
  if (trainingYear && trainingMonth) {
    return `${normalizeName(trainingName)}|${trainingYear}|${trainingMonth}`;
  }
  return `${normalizeName(trainingName)}|${startDate ?? ""}`;
}

async function syncPartnerContactFromTrainingRow(
  supabase: ReturnType<typeof createAdminClient>,
  contacts: PartnerContactRow[],
  row: ImportRow,
  partnerId: string
): Promise<void> {
  const input: TrainingContactSyncInput = {
    partner_id: partnerId,
    name: row.attendee_name,
    department: row.attendee_department,
    position: row.attendee_position,
    phone: row.attendee_phone,
    email: row.attendee_email,
    memo: row.note ?? row.attendee_memo ?? null,
    source_file: row.source_file
  };

  if (!hasContactSyncData(input)) return;

  const existing = findContactForTrainingSync(contacts, partnerId, input);
  if (!existing) {
    const { data: created, error } = await supabase
      .from("partner_contacts")
      .insert(buildReferenceContactInsert(input))
      .select("id, partner_id, name, department, position, email, phone, memo")
      .single();
    if (error) throw new Error(error.message);
    if (created) contacts.push(created as PartnerContactRow);
    return;
  }

  const patch = buildContactFillEmptyPatch(existing, input);
  if (!patch) return;

  const { error } = await supabase
    .from("partner_contacts")
    .update(patch)
    .eq("id", existing.id);
  if (error) throw new Error(error.message);

  if (patch.department) existing.department = input.department;
  if (patch.position) existing.position = input.position;
  if (patch.phone) existing.phone = input.phone;
  if (patch.email) existing.email = input.email;
  if (patch.memo) existing.memo = input.memo;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}
