import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get("snapshot_id");
  if (!snapshotId) {
    return NextResponse.json({ ok: false, message: "snapshot_id 필요" }, { status: 400 });
  }

  const supabase = await createClient();
  const [{ data: snapshot }, { data: opportunities }, { data: revenue }] = await Promise.all([
    supabase.from("partner_performance_snapshots").select("*").eq("id", snapshotId).single(),
    supabase.from("partner_pipeline_opportunities").select("*").eq("snapshot_id", snapshotId),
    supabase.from("partner_revenue_records").select("*").eq("revenue_year", 2025)
  ]);

  const workbook = XLSX.utils.book_new();

  const summaryRows = [
    ["항목", "금액(백만원)", "건수", "기준일", snapshot?.snapshot_date ?? ""],
    ["2026 수주예상 파트너 파이프라인", snapshot?.partner_pipeline_amount_million, snapshot?.partner_pipeline_count],
    ["2026 신규등록 파트너 파이프라인", snapshot?.new_partner_pipeline_amount_million, snapshot?.new_partner_pipeline_count],
    ["2025 파트너 매출 합계", (revenue ?? []).reduce((sum, row) => sum + Number(row.product_revenue_million ?? 0), 0), (revenue ?? []).length]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Executive Summary");

  const opportunitySheet = XLSX.utils.json_to_sheet(
    (opportunities ?? []).map((row) => ({
      파트너: row.partner_name,
      등급: row.partner_grade,
      고객사: row.customer_name,
      프로젝트명: row.project_name,
      프로젝트코드: row.project_code,
      프로젝트등록년: row.project_registered_year,
      예상수주연도: row.expected_win_year,
      예상수주분기: row.expected_win_quarter,
      수주확도: row.win_probability_label,
      제품합계_백만원: row.product_amount_million,
      총합계_백만원: row.total_amount_million,
      본부: row.division,
      영업담당자: row.sales_owner,
      파트너딜: row.is_partner_deal ? "O" : "",
      제품매출: row.is_product_revenue ? "O" : ""
    }))
  );
  XLSX.utils.book_append_sheet(workbook, opportunitySheet, "영업기회 원천");

  const revenueSheet = XLSX.utils.json_to_sheet(
    (revenue ?? []).map((row) => ({
      파트너: row.partner_name,
      등급: row.partner_grade,
      매출_백만원: row.product_revenue_million,
      건수: row.project_count,
      영업담당자: row.sales_owner
    }))
  );
  XLSX.utils.book_append_sheet(workbook, revenueSheet, "매출 실적");

  const definitions = [
    ["지표", "정의"],
    ["2026 수주예상 파트너 파이프라인", "예상수주연도=FY26, 제품매출=O, 파트너딜=O, 금액=제품합계"],
    ["2026 신규등록 파트너 파이프라인", "프로젝트등록년=2026년, 제품매출=O, 파트너딜=O, 금액=제품합계"],
    ["금액 단위", "백만원 (원본)"]
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(definitions), "데이터 정의");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="partner-performance-${snapshot?.snapshot_label ?? "export"}.xlsx"`
    }
  });
}
