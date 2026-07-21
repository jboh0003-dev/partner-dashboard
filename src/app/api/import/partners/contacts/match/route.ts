import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  analyzePartnerContactRows,
  type PartnerContactsDbRow,
  type PartnerContactsPartnerRow
} from "@/lib/imports/partner-contacts";

const ContactRowSchema = z.object({
  row_number: z.number().int(),
  excluded: z.boolean(),
  excluded_reason: z.string().nullable(),
  partner_no: z.string().nullable().default(null),
  company_name: z.string(),
  normalized_company_name: z.string().nullable(),
  contract_date: z.string().nullable().default(null),
  grade: z.string().nullable().default(null),
  region_group: z.string().nullable().default(null),
  contact_name: z.string(),
  role_raw: z.string().nullable(),
  role_type: z.enum(["sales", "engineer", "admin", "executive", "contract", "etc"]),
  department: z.string().nullable(),
  position: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  is_contract_contact: z.boolean(),
  source_file: z.string(),
  warnings: z.array(z.string())
});

const MatchPayloadSchema = z.object({
  rows: z.array(ContactRowSchema)
});

/** 분석/미리보기 — read-only. partner_contacts를 변경하지 않는다. */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = MatchPayloadSchema.parse(json);
    const supabase = createAdminClient();

    const [{ data: partners, error: partnerError }, { data: contacts, error: contactError }] =
      await Promise.all([
        supabase
          .from("partners")
          .select("id, company_name, external_no")
          .is("deleted_at", null),
        supabase
          .from("partner_contacts")
          .select(
            "id, partner_id, name, department, position, role_type, role_raw, email, phone, is_primary, is_contract_contact, is_active, in_current_full_db, deleted_at, merged_into_contact_id, review_required, review_reason, source_file, created_at"
          )
          .is("deleted_at", null)
          .is("merged_into_contact_id", null)
      ]);

    if (partnerError) throw new Error(partnerError.message);
    if (contactError) throw new Error(contactError.message);

    const analysis = analyzePartnerContactRows(
      parsed.rows,
      ((partners ?? []) as unknown) as PartnerContactsPartnerRow[],
      ((contacts ?? []) as unknown) as PartnerContactsDbRow[]
    );

    return NextResponse.json({
      ok: true,
      summary: analysis.summary,
      items: analysis.items,
      baselineExcluded: analysis.baselineExcluded,
      reviewMissing: analysis.baselineExcluded
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "담당자 업로드 미리보기에 실패했습니다."
      },
      { status: 400 }
    );
  }
}
