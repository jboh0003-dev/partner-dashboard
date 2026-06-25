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

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const rows = z.array(EquipmentRowSchema).parse(json.rows);
    const supabase = createAdminClient();

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
      rows,
      (partners ?? []) as PartnerEquipmentPartnerRow[],
      (assets ?? []) as PartnerEquipmentDbRow[]
    );

    return NextResponse.json({
      ok: true,
      items: analysis.items,
      summary: analysis.summary
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "장비 미리보기 실패"
      },
      { status: 400 }
    );
  }
}
