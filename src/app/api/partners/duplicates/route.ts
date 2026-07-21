import { NextResponse } from "next/server";
import type { PartnerMasterDbRow } from "@/lib/imports/partner-master";
import { findPartnerDuplicateGroups } from "@/lib/partners/duplicates";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("partners")
      .select("id, company_name, business_number, external_no, deleted_at, is_active")
      .is("deleted_at", null);

    if (error) {
      throw new Error(error.message);
    }

    const report = findPartnerDuplicateGroups((data ?? []) as PartnerMasterDbRow[]);

    return NextResponse.json({ ok: true, report });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "중복 탐지 실패"
      },
      { status: 400 }
    );
  }
}
