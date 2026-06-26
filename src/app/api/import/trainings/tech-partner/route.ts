import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { correctPhoneEmailSwap } from "@/lib/contacts/phone-email";
import {
  TechPartnerTrainingImportSchema,
  type TechPartnerTrainingImportPayload
} from "@/lib/imports/tech-partner-training-schemas";
import {
  buildTechPartnerContactInsert,
  buildTechPartnerContactPatch,
  findTechPartnerContact,
  type TechPartnerExistingContact
} from "@/lib/imports/tech-partner-contact-sync";
import { TECH_PARTNER_TRAINING_SESSION } from "@/lib/tech-partner-training/constants";
import {
  getTechPartnerTrainingKey,
  isTechPartnerParticipantSaveable,
  validateTechPartnerParticipantsForSave
} from "@/lib/imports/tech-partner-training";
import { normalizePhoneDigits } from "@/lib/tech-partner-training/phone";

type RowResult = {
  participant_name: string;
  company_name: string;
  status: "saved" | "review" | "skipped";
  message: string | null;
};

export async function POST(request: Request) {
  const supabase = createAdminClient();
  let importJobId: string | null = null;

  try {
    const json = await request.json();
    const parsed: TechPartnerTrainingImportPayload = TechPartnerTrainingImportSchema.parse(json);

    const validationError = validateTechPartnerParticipantsForSave(parsed.participants);
    if (validationError) {
      return NextResponse.json({ ok: false, message: validationError }, { status: 400 });
    }

    const { data: importJob, error: importJobError } = await supabase
      .from("import_jobs")
      .insert({
        import_type: "tech_partner_training",
        file_name: `${parsed.exam_file_name} + ${parsed.roster_file_name}`,
        status: "processing",
        total_rows: parsed.participants.length,
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
    importJobId = String(importJob.id);

    const session = TECH_PARTNER_TRAINING_SESSION;
    const trainingKey = getTechPartnerTrainingKey();

    const { data: existingTrainings } = await supabase
      .from("trainings")
      .select("id, training_name, start_date")
      .eq("training_name", session.training_name)
      .eq("start_date", session.start_date);

    let trainingId = existingTrainings?.[0]?.id as string | undefined;

    const trainingPayload = {
      training_name: session.training_name,
      session_name: session.training_name,
      training_type: session.training_type,
      training_level: session.training_level,
      product: session.product,
      product_name: session.product,
      training_year: session.training_year,
      training_month: session.training_month,
      start_date: session.start_date,
      end_date: session.end_date,
      exam_date: session.exam_date,
      description: session.description,
      source_file: `${parsed.exam_file_name}; ${parsed.roster_file_name}`,
      memo: session.description,
      metadata: {
        kind: "tech_partner",
        training_key: trainingKey,
        exam_time: session.exam_time,
        poc_deadline: session.poc_deadline,
        review_date: session.review_date,
        curriculum: session.curriculum,
        exam_file: parsed.exam_file_name,
        roster_file: parsed.roster_file_name
      }
    };

    if (trainingId) {
      await supabase.from("trainings").update(trainingPayload).eq("id", trainingId);
    } else {
      const { data: created, error } = await supabase
        .from("trainings")
        .insert(trainingPayload)
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "교육 세션 생성 실패");
      trainingId = String(created.id);
    }

    const partnerIds = Array.from(
      new Set(
        parsed.participants
          .map((row) => row.matched_partner_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    const contactCache: TechPartnerExistingContact[] = [];
    if (partnerIds.length > 0) {
      const { data: contacts } = await supabase
        .from("partner_contacts")
        .select(
          "id, partner_id, name, department, position, email, phone, memo, role_raw"
        )
        .in("partner_id", partnerIds);
      if (contacts) {
        contactCache.push(...(contacts as TechPartnerExistingContact[]));
      }
    }

    const results: RowResult[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let review = 0;

    for (const row of parsed.participants) {
      if (row.match_action === "exclude") {
        skipped += 1;
        results.push({
          participant_name: row.participant_name,
          company_name: row.company_name,
          status: "skipped",
          message: "제외 처리"
        });
        continue;
      }

      if (
        !isTechPartnerParticipantSaveable({
          ...row,
          matched_partner_id: row.matched_partner_id ?? null
        })
      ) {
        review += 1;
        await supabase.from("import_review_queue").insert({
          import_job_id: importJobId,
          entity_type: "tech_partner_training_participant",
          reason: row.review_reason ?? "매칭 검토 필요",
          raw_data: row
        });
        results.push({
          participant_name: row.participant_name,
          company_name: row.company_name,
          status: "review",
          message: row.review_reason ?? "매칭 검토 필요"
        });
        continue;
      }

      const partnerId = row.matched_partner_id!;
      const corrected = correctPhoneEmailSwap(row.phone, row.email);
      const memoParts = [row.manual_correction_note, row.review_reason].filter(Boolean);
      const contactMemo = memoParts.length > 0 ? memoParts.join(" · ") : null;

      let contactId = row.matched_contact_id ?? null;
      const existingContact = findTechPartnerContact(contactCache, partnerId, {
        name: row.participant_name,
        phone: corrected.phone,
        email: corrected.email
      });

      if (existingContact) {
        contactId = existingContact.id;
        const patch = buildTechPartnerContactPatch(existingContact, {
          partner_id: partnerId,
          name: row.participant_name,
          title: row.title ?? null,
          phone: corrected.phone,
          email: corrected.email,
          memo: contactMemo
        });
        if (patch) {
          await supabase.from("partner_contacts").update(patch).eq("id", existingContact.id);
          Object.assign(existingContact, patch);
        }
      } else if (!contactId) {
        const { data: newContact, error: contactError } = await supabase
          .from("partner_contacts")
          .insert(
            buildTechPartnerContactInsert({
              partner_id: partnerId,
              name: row.participant_name,
              title: row.title ?? null,
              phone: corrected.phone,
              email: corrected.email,
              memo: contactMemo
            })
          )
          .select("id, partner_id, name, department, position, email, phone, memo, role_raw")
          .single();
        if (!contactError && newContact) {
          contactId = String(newContact.id);
          contactCache.push(newContact as TechPartnerExistingContact);
        }
      }

      const attended =
        (row.attendance_days ?? 0) > 0 ||
        row.has_any_attendance_record ||
        row.correction_applied ||
        row.education_status === "partial_attended";

      const extra_json = {
        solution_understanding_score: row.solution_understanding_score,
        technical_test_score: row.technical_test_score,
        advanced_basic_score: row.advanced_basic_score,
        operation_score: row.operation_score,
        troubleshooting_score: row.troubleshooting_score,
        daily_attendance: row.daily_attendance ?? null,
        exam_raw_json: row.exam_raw_json ?? null,
        education_status: row.education_status ?? null,
        attendance_scope: row.attendance_scope ?? null,
        manual_correction_note: row.manual_correction_note ?? null,
        correction_applied: row.correction_applied ?? false
      };

      const attendancePayload = {
        partner_id: partnerId,
        training_id: trainingId,
        contact_id: contactId,
        attendee_name: row.participant_name,
        attendee_position: row.title,
        attendee_phone: corrected.phone,
        attendee_email: corrected.email,
        attended,
        attendance_status:
          row.exam_status === "응시"
            ? "응시"
            : row.exam_status === "미응시"
              ? "미응시"
              : row.exam_status,
        completion_status: row.exam_status,
        score: row.total_score,
        converted_score: row.converted_score,
        rank: row.rank,
        exam_status: row.exam_status,
        attendance_days: row.attendance_days,
        partial_days: row.partial_days,
        absent_days: row.absent_days,
        attendance_rate: row.attendance_rate,
        group_name: row.group_name,
        match_status: row.correction_applied ? "matched" : row.match_status,
        review_reason: row.correction_applied ? null : row.review_reason,
        evaluation_result: row.exam_status,
        note: contactMemo,
        source_file: [row.roster_source_file, row.exam_source_file].filter(Boolean).join("; "),
        extra_json
      };

      const phoneDigits = normalizePhoneDigits(corrected.phone);
      const { data: existingRows } = await supabase
        .from("training_attendance")
        .select("id, attendee_phone")
        .eq("training_id", trainingId)
        .eq("partner_id", partnerId)
        .ilike("attendee_name", row.participant_name);

      const existing =
        (existingRows ?? []).find(
          (candidate) => normalizePhoneDigits(candidate.attendee_phone) === phoneDigits
        ) ??
        (phoneDigits === ""
          ? (existingRows ?? []).find(
              (candidate) => !normalizePhoneDigits(candidate.attendee_phone)
            )
          : undefined);

      if (existing?.id) {
        const { error } = await supabase
          .from("training_attendance")
          .update(attendancePayload)
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        updated += 1;
      } else {
        const { error } = await supabase.from("training_attendance").insert(attendancePayload);
        if (error) throw new Error(error.message);
        created += 1;
      }

      if (row.needs_review && !row.correction_applied) {
        review += 1;
        await supabase.from("import_review_queue").insert({
          import_job_id: importJobId,
          entity_type: "tech_partner_training_participant",
          reason: row.review_reason ?? "저장 후 검토 필요",
          raw_data: row
        });
        results.push({
          participant_name: row.participant_name,
          company_name: row.company_name,
          status: "saved",
          message: row.review_reason ?? "저장 후 검토 필요"
        });
      } else {
        results.push({
          participant_name: row.participant_name,
          company_name: row.company_name,
          status: "saved",
          message: row.correction_applied ? "보정 적용 후 저장" : "저장"
        });
      }
    }

    await supabase
      .from("import_jobs")
      .update({
        status: "completed",
        created_count: created,
        updated_count: updated,
        skipped_count: skipped,
        review_count: review
      })
      .eq("id", importJobId);

    revalidatePath("/dashboard/trainings");
    revalidatePath("/dashboard/trainings/tech-partner-upload");
    revalidatePath("/dashboard/partners", "layout");

    return NextResponse.json({
      ok: true,
      training_id: trainingId,
      created,
      updated,
      skipped,
      review,
      results
    });
  } catch (error) {
    if (importJobId) {
      await supabase
        .from("import_jobs")
        .update({ status: "failed" })
        .eq("id", importJobId);
    }
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "저장에 실패했습니다."
      },
      { status: 400 }
    );
  }
}
