import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { z } from "zod";
import { parseRevenueRowsFromWorkbook, type ParsedRevenueRow } from "@/lib/excel/parse-partner-performance";
import { applyPartnerMatch } from "@/lib/imports/partner-revenue";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUnknownPartnerName } from "@/lib/partners/performance-match";

function resolveDbMatchStatus(row: {
  matched_partner_id?: string | null;
  raw_partner_name?: string | null;
  partner_name?: string | null;
  match_status?: string | null;
}): string {
  if (row.matched_partner_id) return "matched";
  const raw = row.raw_partner_name ?? row.partner_name;
  if (isUnknownPartnerName(raw)) return "unknown_partner";
  if (row.match_status === "review") return "review_needed";
  return "unmatched";
}

const RevenueRowSchema = z.object({
  row_number: z.number(),
  partner_name: z.string(),
  partner_grade: z.string().nullable().optional(),
  sales_owner: z.string().nullable().optional(),
  product_revenue_million: z.number(),
  project_count: z.number().nullable().optional(),
  customer_name: z.string().nullable().optional(),
  project_code: z.string().nullable().optional(),
  project_name: z.string().nullable().optional(),
  raw_json: z.record(z.string(), z.unknown()).optional()
});

const SaveSchema = z.object({
  file_name: z.string(),
  revenue_rows: z.array(RevenueRowSchema).min(1)
});

export async function POST(request: Request) {
  const supabase = createAdminClient();
  let importJobId: string | null = null;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let fileName: string;
    let revenueRows: ParsedRevenueRow[];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, message: "파일이 없습니다." }, { status: 400 });
      }
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      revenueRows = parseRevenueRowsFromWorkbook(workbook);
      fileName = file.name;
    } else {
      const json = await request.json();
      const parsed = SaveSchema.parse(json);
      fileName = parsed.file_name;
      revenueRows = parsed.revenue_rows.map((row) => ({
        row_number: row.row_number,
        partner_name: row.partner_name,
        partner_grade: row.partner_grade ?? null,
        sales_owner: row.sales_owner ?? null,
        product_revenue_million: row.product_revenue_million,
        project_count: row.project_count ?? null,
        customer_name: row.customer_name ?? null,
        project_code: row.project_code ?? null,
        project_name: row.project_name ?? null,
        raw_json: row.raw_json ?? { section: "revenue" }
      }));
    }

    if (revenueRows.length === 0) {
      return NextResponse.json({ ok: false, message: "2025 파트너 매출 데이터를 찾지 못했습니다." }, { status: 400 });
    }

    const { data: importJob, error: importJobError } = await supabase
      .from("import_jobs")
      .insert({
        import_type: "partner_revenue_2025",
        file_name: fileName,
        status: "processing",
        total_rows: revenueRows.length,
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

    const [{ data: partners }, { data: aliases }] = await Promise.all([
      supabase.from("partners").select("id, company_name, business_number").is("deleted_at", null),
      supabase.from("partner_aliases").select("partner_id, alias_name, normalized_alias")
    ]);

    const partnerRows = (partners ?? []).map((p) => ({
      id: String(p.id),
      company_name: String(p.company_name),
      business_number: p.business_number ? String(p.business_number) : null
    }));
    const aliasRows = (aliases ?? []).map((a) => ({
      partner_id: String(a.partner_id),
      alias_name: String(a.alias_name),
      normalized_alias: String(a.normalized_alias)
    }));

    const matchedRows = revenueRows.map((row) => applyPartnerMatch(row, partnerRows, aliasRows));

    const { error: deleteError } = await supabase
      .from("partner_revenue_records")
      .delete()
      .eq("revenue_year", 2025);
    if (deleteError) throw new Error(deleteError.message);

    let created = 0;
    let review = 0;

    for (const row of matchedRows) {
      const { error } = await supabase.from("partner_revenue_records").insert({
        revenue_year: 2025,
        partner_name: row.matched_partner_name ?? row.partner_name,
        raw_partner_name: row.raw_partner_name ?? row.partner_name,
        matched_partner_id: row.matched_partner_id ?? null,
        match_status: resolveDbMatchStatus(row),
        match_reason: row.match_reason ?? null,
        partner_grade: row.partner_grade ?? null,
        sales_owner: row.sales_owner ?? null,
        product_revenue_million: row.product_revenue_million,
        project_count: row.project_count ?? null,
        source_sheet: row.raw_json?.sheet_name ? String(row.raw_json.sheet_name) : null,
        source_file_name: fileName,
        raw_json: row.raw_json ?? null
      });
      if (error) throw new Error(error.message);
      created += 1;

      if (!row.matched_partner_id && !isUnknownPartnerName(row.raw_partner_name ?? row.partner_name)) {
        review += 1;
        await supabase.from("import_review_queue").insert({
          import_job_id: importJobId,
          entity_type: "partner_revenue_record",
          reason: row.match_reason ?? "파트너명 매칭 실패",
          raw_data: row
        });
      }
    }

    await supabase
      .from("import_jobs")
      .update({
        status: "completed",
        created_count: created,
        review_count: review
      })
      .eq("id", importJobId);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/performance");

    return NextResponse.json({
      ok: true,
      revenue_created: created,
      revenue_review: review,
      revenue_total_million: Math.round(
        matchedRows
          .filter((row) => row.matched_partner_id)
          .reduce((sum, row) => sum + row.product_revenue_million, 0)
      )
    });
  } catch (error) {
    if (importJobId) {
      await supabase.from("import_jobs").update({ status: "failed" }).eq("id", importJobId);
    }
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "저장 실패"
      },
      { status: 400 }
    );
  }
}
