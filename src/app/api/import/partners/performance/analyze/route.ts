import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePartnerPerformanceWorkbook } from "@/lib/excel/parse-partner-performance";
import { analyzePartnerPerformanceUpload } from "@/lib/imports/partner-performance";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "파일이 없습니다." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const parsed = parsePartnerPerformanceWorkbook(workbook, file.name);

    const supabase = createAdminClient();
    const [{ data: partners }, { data: aliases }] = await Promise.all([
      supabase.from("partners").select("id, company_name, business_number").is("deleted_at", null),
      supabase.from("partner_aliases").select("partner_id, alias_name, normalized_alias")
    ]);

    const analysis = analyzePartnerPerformanceUpload({
      inventory_rows: parsed.inventory_rows,
      revenue_rows: parsed.revenue_rows,
      snapshot_date: parsed.snapshot_date,
      snapshot_label: parsed.snapshot_label,
      summary_validation: parsed.summary_validation,
      partners: (partners ?? []).map((p) => ({
        id: String(p.id),
        company_name: String(p.company_name),
        business_number: p.business_number ? String(p.business_number) : null
      })),
      aliases: (aliases ?? []).map((a) => ({
        partner_id: String(a.partner_id),
        alias_name: String(a.alias_name),
        normalized_alias: String(a.normalized_alias)
      })),
      required_columns_found: parsed.required_columns_found,
      parse_errors: parsed.parse_errors
    });

    return NextResponse.json({
      ok: true,
      file_name: file.name,
      inventory_sheet_name: parsed.inventory_sheet_name,
      summary_validation: parsed.summary_validation,
      ...analysis
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "분석 실패"
      },
      { status: 400 }
    );
  }
}
