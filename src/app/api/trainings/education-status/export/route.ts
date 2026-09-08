import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { rejectUnlessAdmin } from "@/lib/auth/require-admin";
import { isSamplePartnerName } from "@/lib/partners/sample-filter";
import { createClient } from "@/lib/supabase/server";
import {
  EDUCATION_STATUS_ATTENDANCE_SELECT,
  EDUCATION_STATUS_EMPTY_MESSAGE,
  educationStatusExcelAoA,
  educationStatusFilename,
  filterEducationStatusAttendees,
  flattenAttendeeRows,
  toEducationStatusExcelRows
} from "@/lib/trainings/education-status-export";

export async function GET(request: Request) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const month = searchParams.get("month") || "all";
  const training = searchParams.get("training") || "all";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_attendance")
    .select(EDUCATION_STATUS_ATTENDANCE_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const rows = filterEducationStatusAttendees(
    flattenAttendeeRows(data).filter(
      (row) => row.is_non_partner || !isSamplePartnerName(row.partner_name)
    ),
    { q, month, training }
  );

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, message: EDUCATION_STATUS_EMPTY_MESSAGE }, { status: 404 });
  }

  const filename = educationStatusFilename(month);
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(educationStatusExcelAoA(toEducationStatusExcelRows(rows)));
  XLSX.utils.book_append_sheet(workbook, sheet, "교육현황");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store"
    }
  });
}
