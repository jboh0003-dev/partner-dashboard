import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  analyzePartnerEquipmentRows,
  type PartnerEquipmentDbRow,
  type PartnerEquipmentPartnerRow
} from "@/lib/imports/partner-equipment";

const EquipmentRowSchema = z.object({
  row_number: z.number().int(),
  excluded: z.boolean(),
  excluded_reason: z.string().nullable(),
  company_name: z.string(),
  normalized_company_name: z.string().nullable(),
  asset_group: z.string().nullable(),
  node_type: z.string().nullable(),
  node_name: z.string().nullable(),
  form_factor: z.string().nullable(),
  cpu: z.string().nullable(),
  memory: z.string().nullable(),
  os_disk: z.string().nullable(),
  ceph_disk: z.string().nullable(),
  nic: z.string().nullable(),
  asset_status: z.string().nullable(),
  asset_type: z.string().nullable(),
  spec_summary: z.string().nullable(),
  asset_name: z.string().nullable(),
  vendor: z.string().nullable(),
  model_name: z.string().nullable(),
  quantity: z.number().nullable(),
  memo: z.string().nullable(),
  source_file: z.string(),
  warnings: z.array(z.string())
});

const ImportPayloadSchema = z.object({
  file_name: z.string().min(1),
  rows: z.array(EquipmentRowSchema)
});

type ImportRow = z.infer<typeof EquipmentRowSchema>;

export async function POST(request: Request) {
  const supabase = createAdminClient();
  let importJobId: string | null = null;

  try {
    const json = await request.json();
    const parsed = ImportPayloadSchema.parse(json);
    const syncedAt = new Date().toISOString();

    const { data: importJob, error: importJobError } = await supabase
      .from("import_jobs")
      .insert({
        import_type: "partner_equipment",
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

    const [{ data: partners, error: partnerError }, { data: assets, error: assetError }] =
      await Promise.all([
        supabase.from("partners").select("id, company_name"),
        supabase
          .from("partner_assets")
          .select("id, partner_id, asset_type, spec_summary, asset_name, node_name")
      ]);

    if (partnerError) throw new Error(partnerError.message);
    if (assetError) throw new Error(assetError.message);

    const analysis = analyzePartnerEquipmentRows(
      parsed.rows,
      (partners ?? []) as PartnerEquipmentPartnerRow[],
      (assets ?? []) as PartnerEquipmentDbRow[]
    );
    const analysisMap = new Map(analysis.items.map((item) => [item.row_number, item]));

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let reviewCount = 0;
    const results: Array<{
      company_name: string;
      status: "created" | "updated" | "skipped" | "review";
      partner_id: string | null;
      message: string | null;
    }> = [];

    for (const row of parsed.rows) {
      const item = analysisMap.get(row.row_number);
      if (!item) continue;

      if (item.action === "skip") {
        skippedCount += 1;
        results.push({
          company_name: row.company_name || "(회사명 없음)",
          status: "skipped",
          partner_id: null,
          message: item.reason
        });
        continue;
      }

      if (item.action === "review") {
        reviewCount += 1;
        const { error } = await supabase.from("import_review_queue").insert({
          import_job_id: importJobId,
          import_type: "partner_equipment",
          row_number: row.row_number,
          company_name: row.company_name,
          reason: item.reason,
          raw_data: row,
          status: "pending"
        });
        if (error) throw new Error(error.message);

        results.push({
          company_name: row.company_name,
          status: "review",
          partner_id: item.matched_partner_id,
          message: item.reason
        });
        continue;
      }

      if (!item.matched_partner_id) {
        throw new Error("장비 저장 대상 partner_id가 없습니다.");
      }

      const payload = buildAssetPayload(row, item.matched_partner_id, syncedAt, parsed.file_name);

      if (item.action === "create") {
        const { error } = await supabase.from("partner_assets").insert(payload);
        if (error) throw new Error(error.message);
        createdCount += 1;
        results.push({
          company_name: row.company_name,
          status: "created",
          partner_id: item.matched_partner_id,
          message: item.reason
        });
        continue;
      }

      if (!item.matched_asset_id) {
        throw new Error("업데이트 대상 asset_id가 없습니다.");
      }

      const { error } = await supabase
        .from("partner_assets")
        .update(payload)
        .eq("id", item.matched_asset_id);
      if (error) throw new Error(error.message);

      updatedCount += 1;
      results.push({
        company_name: row.company_name,
        status: "updated",
        partner_id: item.matched_partner_id,
        message: item.reason
      });
    }

    await supabase
      .from("import_jobs")
      .update({
        status: "completed",
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        review_count: reviewCount
      })
      .eq("id", importJobId);

    revalidatePath("/dashboard/assets");
    revalidatePath("/dashboard/upload");
    revalidatePath("/dashboard/partners", "layout");

    return NextResponse.json({
      ok: true,
      summary: {
        total: parsed.rows.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        review: reviewCount,
        errors: 0
      },
      results
    });
  } catch (error) {
    if (importJobId) {
      await supabase.from("import_jobs").update({ status: "failed" }).eq("id", importJobId);
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "장비 업로드 실패"
      },
      { status: 400 }
    );
  }
}

function buildAssetPayload(
  row: ImportRow,
  partnerId: string,
  syncedAt: string,
  fileName: string
) {
  return {
    partner_id: partnerId,
    partner_name_raw: row.company_name,
    asset_group: row.asset_group,
    node_type: row.node_type,
    node_name: row.node_name,
    form_factor: row.form_factor,
    cpu: row.cpu,
    memory: row.memory,
    os_disk: row.os_disk,
    ceph_disk: row.ceph_disk,
    nic: row.nic,
    asset_status: row.asset_status,
    asset_type: row.node_type ?? row.asset_type,
    asset_name: row.node_name ?? row.asset_name ?? row.spec_summary,
    vendor: row.vendor,
    model_name: row.model_name,
    spec_summary: row.spec_summary,
    quantity: row.quantity ?? 1,
    memo: row.memo,
    status: row.asset_status,
    match_status: "matched",
    source_file: fileName,
    last_synced_at: syncedAt
  };
}
