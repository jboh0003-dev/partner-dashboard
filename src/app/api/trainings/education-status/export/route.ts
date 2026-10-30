import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/auth/require-admin";
import { getRealPartnerIdSet } from "@/lib/partners/sample-filter";
import { fetchAllRows } from "@/lib/imports/fetch-all-rows";
import { createClient } from "@/lib/supabase/server";
import {
  buildEducationOverview,
  dedupeTrainingAttendanceRows,
  filterOfficialTrainingAttendees
} from "@/lib/trainings/overview-stats";
import type { Training } from "@/types/training";
import {
  EDUCATION_STATUS_ATTENDANCE_SELECT,
  EDUCATION_STATUS_EMPTY_MESSAGE,
  educationStatusExcelAoA,
  educationStatusFilename,
  filterEducationStatusAttendees,
  flattenAttendeeRows,
  toEducationStatusExcelRows
} from "@/lib/trainings/education-status-export";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const month = searchParams.get("month") || "all";
  const training = searchParams.get("training") || "all";

  try {
    const supabase = await createClient();
    const [data, trainingResponse, partnerResponse] = await Promise.all([
      fetchAllRows<Record<string, unknown>>((from, to) =>
        supabase
          .from("training_attendance")
          .select(EDUCATION_STATUS_ATTENDANCE_SELECT)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(from, to)
      ),
      supabase.from("trainings").select("*").is("deleted_at", null),
      supabase.from("partners").select("id, company_name, external_no, memo").is("deleted_at", null)
    ]);
    if (trainingResponse.error) throw new Error(trainingResponse.error.message);
    if (partnerResponse.error) throw new Error(partnerResponse.error.message);

    const trainings = (trainingResponse.data ?? []) as Training[];
    const activeIds = new Set(trainings.map((item) => item.id));
    const realPartnerIds = getRealPartnerIdSet(partnerResponse.data ?? []);
    const eligible = dedupeTrainingAttendanceRows(
      filterOfficialTrainingAttendees(
        flattenAttendeeRows(data),
        realPartnerIds,
        activeIds
      )
    );
    const rows = filterEducationStatusAttendees(eligible, { q, month, training });
    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, message: EDUCATION_STATUS_EMPTY_MESSAGE },
        { status: 404 }
      );
    }

    const { yearly, monthly } = buildEducationOverview(trainings, eligible);
    const workbook = XLSX.utils.book_new();

    const yearlySheet = XLSX.utils.aoa_to_sheet([
      ["교육 연도", "교육 운영월", "중복제외 참석자", "참여연인원(월별 합계)", "참석 파트너"],
      ...yearly.map((row) => [
        row.year, row.monthCount, row.uniqueAttendees, row.participationCount, row.partnerCount
      ])
    ]);
    yearlySheet["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 19 }, { wch: 24 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, yearlySheet, "연도별 요약");

    const monthlySheet = XLSX.utils.aoa_to_sheet([
      ["교육 연월", "교육 과정", "중복제외 참석자", "참석 파트너"],
      ...monthly.map((row) => [
        row.label, row.courseSummary, row.attendanceCount, row.partnerCount
      ])
    ]);
    monthlySheet["!cols"] = [{ wch: 29 }, { wch: 54 }, { wch: 21 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, monthlySheet, "월별 요약");

    const details = XLSX.utils.aoa_to_sheet(
      educationStatusExcelAoA(toEducationStatusExcelRows(rows))
    );
    details["!cols"] = [
      { wch: 24 }, { wch: 18 }, { wch: 38 }, { wch: 24 },
      { wch: 16 }, { wch: 22 }, { wch: 19 }, { wch: 31 },
      { wch: 13 }, { wch: 15 }, { wch: 35 }
    ];
    XLSX.utils.book_append_sheet(workbook, details, "참석자 상세");

    const filename = educationStatusFilename(month);
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"" + filename + "\"; filename*=UTF-8''" + encodeURIComponent(filename),
        "Cache-Control": "private, no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "교육 현황 다운로드 실패" },
      { status: 500 }
    );
  }
}
