import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  analyzeTrainingAttendanceRows,
  type ExistingTrainingAttendanceRow,
  type TrainingAttendancePartnerRow,
  type TrainingMasterRow
} from "@/lib/imports/training-attendance-detail";
import {
  TrainingAttendanceRowSchema,
  type TrainingAttendanceImportRow
} from "@/lib/imports/training-attendance-schemas";
import { z } from "zod";

const PayloadSchema = z.object({
  rows: z.array(TrainingAttendanceRowSchema)
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = PayloadSchema.parse(json);
    const supabase = createAdminClient();

    const [
      { data: partners, error: partnerError },
      { data: trainings, error: trainingError },
      { data: attendances, error: attendanceError }
    ] = await Promise.all([
      supabase.from("partners").select("id, company_name"),
      supabase
        .from("trainings")
        .select(
          "id, training_name, training_type, training_level, product, product_name, session_name, start_date, training_year, training_month"
        ),
      supabase
        .from("training_attendance")
        .select("id, partner_id, training_id, attendee_name")
    ]);

    if (partnerError) throw new Error(partnerError.message);
    if (trainingError) throw new Error(trainingError.message);
    if (attendanceError) throw new Error(attendanceError.message);

    const analysis = analyzeTrainingAttendanceRows(
      parsed.rows as TrainingAttendanceImportRow[],
      ((partners ?? []) as unknown) as TrainingAttendancePartnerRow[],
      ((trainings ?? []) as unknown) as TrainingMasterRow[],
      ((attendances ?? []) as unknown) as ExistingTrainingAttendanceRow[]
    );

    const importableCount = parsed.rows.filter((row) => !row.excluded).length;
    console.log("[training-attendance-match]", {
      rowCount: parsed.rows.length,
      importableCount,
      summary: analysis.summary
    });

    if (parsed.rows.length > 0 && analysis.summary.total === 0) {
      analysis.summary.total = parsed.rows.length;
    }

    const classified =
      analysis.summary.new_trainings +
      analysis.summary.new_attendees +
      analysis.summary.updates +
      analysis.summary.review +
      analysis.summary.skipped;

    if (importableCount > 0 && classified === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "분석 결과가 0건입니다. 컬럼 매핑 또는 시트 선택을 확인해 주세요."
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      summary: analysis.summary,
      items: analysis.items
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "정기교육 참석자 미리보기에 실패했습니다."
      },
      { status: 400 }
    );
  }
}
