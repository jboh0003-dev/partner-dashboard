import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { deleteTempImportFile, writeImportLog } from "@/lib/imports/import-logs";
import {
  refreshPipelineCurrentSnapshot,
  resolvePipelineSnapshotSaveTarget
} from "@/lib/performance/snapshot-persistence";
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

const InventoryRowSchema = z.object({
  row_number: z.number(),
  customer_name: z.string().nullable().optional(),
  project_code: z.string(),
  project_registered_year: z.string().nullable().optional(),
  project_name: z.string().nullable().optional(),
  sales_owner: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  org_path: z.string().nullable().optional(),
  expected_win_year: z.string().nullable().optional(),
  expected_win_quarter: z.string().nullable().optional(),
  expected_win_month: z.string().nullable().optional(),
  importance: z.string().nullable().optional(),
  rfp_reflection: z.string().nullable().optional(),
  win_probability_label: z.string().nullable().optional(),
  win_probability_value: z.number().nullable().optional(),
  win_status: z.string().nullable().optional(),
  execution_status: z.string().nullable().optional(),
  participation_type: z.string().nullable().optional(),
  contract_owner: z.string().nullable().optional(),
  expected_contract_partner: z.string().nullable().optional(),
  is_partner_deal: z.boolean(),
  partner_grade: z.string().nullable().optional(),
  partner_name: z.string().nullable().optional(),
  matched_partner_id: z.string().uuid().nullable().optional(),
  matched_partner_name: z.string().nullable().optional(),
  raw_partner_name: z.string().nullable().optional(),
  match_status: z.enum(["matched", "review"]).optional(),
  match_reason: z.string().nullable().optional(),
  is_product_revenue: z.boolean(),
  contract_type: z.string().nullable().optional(),
  product_amount_million: z.number().nullable().optional(),
  service_amount_million: z.number().nullable().optional(),
  maintenance_amount_million: z.number().nullable().optional(),
  total_amount_million: z.number().nullable().optional(),
  product_contrabass: z.number().nullable().optional(),
  product_contrabass_hci: z.number().nullable().optional(),
  product_contrabass_legato: z.number().nullable().optional(),
  product_viola: z.number().nullable().optional(),
  product_cmp: z.number().nullable().optional(),
  product_trombone: z.number().nullable().optional(),
  product_trumpet: z.number().nullable().optional(),
  product_symphony_ai: z.number().nullable().optional(),
  product_tuba: z.number().nullable().optional(),
  product_gaidsp: z.number().nullable().optional(),
  raw_json: z.record(z.string(), z.unknown()).optional()
});

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
  matched_partner_id: z.string().uuid().nullable().optional(),
  matched_partner_name: z.string().nullable().optional(),
  raw_partner_name: z.string().nullable().optional(),
  match_status: z.enum(["matched", "review"]).optional(),
  match_reason: z.string().nullable().optional(),
  raw_json: z.record(z.string(), z.unknown()).optional()
});

const SaveSchema = z.object({
  file_name: z.string(),
  snapshot_date: z.string(),
  snapshot_label: z.string(),
  duplicate_mode: z.enum(["replace", "new_version"]).default("replace"),
  storage_path: z.string().nullable().optional(),
  summary: z.object({
    total_pipeline_amount_million: z.number(),
    total_pipeline_count: z.number(),
    partner_pipeline_amount_million: z.number(),
    partner_pipeline_count: z.number(),
    new_total_pipeline_amount_million: z.number(),
    new_total_pipeline_count: z.number(),
    new_partner_pipeline_amount_million: z.number(),
    new_partner_pipeline_count: z.number()
  }),
  inventory_rows: z.array(InventoryRowSchema).min(1),
  revenue_rows: z.array(RevenueRowSchema).optional()
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return unauthorizedJson(auth.message);

  const supabase = createAdminClient();
  let importJobId: string | null = null;

  try {
    const json = await request.json();
    const parsed = SaveSchema.parse(json);

    const { data: importJob, error: importJobError } = await supabase
      .from("import_jobs")
      .insert({
        import_type: "partner_performance",
        file_name: parsed.file_name,
        status: "processing",
        total_rows: parsed.inventory_rows.length,
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

    const { snapshotId, snapshotAction, version } = await resolvePipelineSnapshotSaveTarget(
      supabase,
      {
        snapshot_date: parsed.snapshot_date,
        snapshot_label: parsed.snapshot_label,
        source_file_name: parsed.file_name,
        duplicate_mode: parsed.duplicate_mode,
        summary: parsed.summary
      }
    );

    if (snapshotAction === "replaced") {
      const { error: deleteOppsError } = await supabase
        .from("partner_pipeline_opportunities")
        .delete()
        .eq("snapshot_id", snapshotId);
      if (deleteOppsError) throw new Error(deleteOppsError.message);
    }

    let created = 0;
    let updated = 0;
    let review = 0;

    for (const row of parsed.inventory_rows) {
      if (!row.project_code?.trim()) continue;

      const payload = {
        snapshot_id: snapshotId,
        snapshot_date: parsed.snapshot_date,
        project_code: row.project_code.trim(),
        customer_name: row.customer_name ?? null,
        project_name: row.project_name ?? null,
        project_registered_year: row.project_registered_year ?? null,
        sales_owner: row.sales_owner ?? null,
        division: row.division ?? null,
        company: row.company ?? null,
        org_path: row.org_path ?? null,
        expected_win_year: row.expected_win_year ?? null,
        expected_win_quarter: row.expected_win_quarter ?? null,
        expected_win_month: row.expected_win_month ?? null,
        importance: row.importance ?? null,
        rfp_reflection: row.rfp_reflection ?? null,
        win_probability_label: row.win_probability_label ?? null,
        win_probability_value: row.win_probability_value ?? null,
        win_status: row.win_status ?? null,
        execution_status: row.execution_status ?? null,
        participation_type: row.participation_type ?? null,
        contract_owner: row.contract_owner ?? null,
        expected_contract_partner: row.expected_contract_partner ?? null,
        is_partner_deal: row.is_partner_deal,
        partner_grade: row.partner_grade ?? null,
        partner_name: row.partner_name ?? null,
        raw_partner_name: row.raw_partner_name ?? row.partner_name ?? null,
        matched_partner_id: row.matched_partner_id ?? null,
        matched_partner_name: row.matched_partner_name ?? null,
        match_status: resolveDbMatchStatus(row),
        match_reason: row.match_reason ?? null,
        is_product_revenue: row.is_product_revenue,
        contract_type: row.contract_type ?? null,
        product_amount_million: row.product_amount_million ?? null,
        service_amount_million: row.service_amount_million ?? null,
        maintenance_amount_million: row.maintenance_amount_million ?? null,
        total_amount_million: row.total_amount_million ?? null,
        product_contrabass: row.product_contrabass ?? null,
        product_contrabass_hci: row.product_contrabass_hci ?? null,
        product_contrabass_legato: row.product_contrabass_legato ?? null,
        product_viola: row.product_viola ?? null,
        product_cmp: row.product_cmp ?? null,
        product_trombone: row.product_trombone ?? null,
        product_trumpet: row.product_trumpet ?? null,
        product_symphony_ai: row.product_symphony_ai ?? null,
        product_tuba: row.product_tuba ?? null,
        product_gaidsp: row.product_gaidsp ?? null,
        raw_json: row.raw_json ?? null,
        updated_at: new Date().toISOString()
      };

      if (snapshotAction === "replaced") {
        const { error } = await supabase.from("partner_pipeline_opportunities").insert(payload);
        if (error) throw new Error(error.message);
        created += 1;
      } else {
        const { data: existing } = await supabase
          .from("partner_pipeline_opportunities")
          .select("id")
          .eq("snapshot_id", snapshotId)
          .eq("project_code", row.project_code.trim())
          .maybeSingle();

        if (existing?.id) {
          const { error } = await supabase
            .from("partner_pipeline_opportunities")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          updated += 1;
        } else {
          const { error } = await supabase.from("partner_pipeline_opportunities").insert(payload);
          if (error) throw new Error(error.message);
          created += 1;
        }
      }

      if (!row.matched_partner_id && !isUnknownPartnerName(row.raw_partner_name ?? row.partner_name)) {
        review += 1;
        await supabase.from("import_review_queue").insert({
          import_job_id: importJobId,
          entity_type: "partner_pipeline_opportunity",
          reason: row.match_reason ?? "파트너명 매칭 실패",
          raw_data: row
        });
      }
    }

    const currentSnapshotId = await refreshPipelineCurrentSnapshot(supabase);

    let revenueCreated = 0;
    let revenueReview = 0;

    if (
      (parsed.revenue_rows ?? []).length > 0 &&
      currentSnapshotId === snapshotId
    ) {
      const { error: deleteError } = await supabase
        .from("partner_revenue_records")
        .delete()
        .eq("revenue_year", 2025);
      if (deleteError) throw new Error(deleteError.message);

      for (const row of parsed.revenue_rows ?? []) {
        const { error } = await supabase.from("partner_revenue_records").insert({
          revenue_year: 2025,
          partner_name: row.matched_partner_name ?? row.partner_name,
          raw_partner_name: row.raw_partner_name ?? row.partner_name,
          matched_partner_id: row.matched_partner_id ?? null,
          match_status: resolveDbMatchStatus(row),
          match_reason: row.match_reason ?? null,
          partner_grade: row.partner_grade ?? null,
          sales_owner: row.sales_owner ?? null,
          project_code: row.project_code ?? null,
          customer_name: row.customer_name ?? null,
          project_name: row.project_name ?? null,
          product_revenue_million: row.product_revenue_million,
          project_count: row.project_count ?? null,
          source_sheet: row.raw_json?.sheet_name ? String(row.raw_json.sheet_name) : null,
          source_file_name: parsed.file_name,
          raw_json: row.raw_json ?? null
        });
        if (error) throw new Error(error.message);
        revenueCreated += 1;

        if (!row.matched_partner_id && !isUnknownPartnerName(row.raw_partner_name ?? row.partner_name)) {
          revenueReview += 1;
          await supabase.from("import_review_queue").insert({
            import_job_id: importJobId,
            entity_type: "partner_revenue_record",
            reason: row.match_reason ?? "파트너명 매칭 실패",
            raw_data: row
          });
        }
      }
    }

    const storageDeleted = await deleteTempImportFile(supabase, parsed.storage_path ?? null);

    await writeImportLog(supabase, {
      import_type: "partner_pipeline_snapshot",
      original_filename: parsed.file_name,
      total_rows: parsed.inventory_rows.length,
      success_count: created + revenueCreated,
      failed_count: 0,
      review_count: review + revenueReview,
      merge_count: 0,
      excluded_count: 0,
      storage_file_deleted: storageDeleted,
      storage_path: parsed.storage_path ?? null,
      status: "success",
      import_job_id: importJobId,
      metadata: {
        snapshot_id: snapshotId,
        snapshot_action: snapshotAction,
        snapshot_date: parsed.snapshot_date,
        version,
        duplicate_mode: parsed.duplicate_mode,
        is_current: currentSnapshotId === snapshotId
      }
    });

    await supabase
      .from("import_jobs")
      .update({
        status: "completed",
        created_count: created + revenueCreated,
        updated_count: updated,
        review_count: review + revenueReview
      })
      .eq("id", importJobId);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/performance");
    revalidatePath("/dashboard/performance/upload");
    revalidatePath("/dashboard/partners", "layout");

    return NextResponse.json({
      ok: true,
      snapshot_id: snapshotId,
      snapshot_action: snapshotAction,
      snapshot_version: version,
      is_current: currentSnapshotId === snapshotId,
      created,
      updated,
      review,
      revenue_created: revenueCreated,
      revenue_review: revenueReview,
      storage_deleted: storageDeleted
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
