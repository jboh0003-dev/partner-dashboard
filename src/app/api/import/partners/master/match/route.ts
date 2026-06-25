import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  analyzePartnerMasterRows,
  type PartnerMasterDbRow
} from "@/lib/imports/partner-master";

const MasterRowSchema = z.object({
  row_number: z.number().int(),
  excluded: z.boolean(),
  excluded_reason: z.string().nullable(),
  company_name: z.string(),
  normalized_company_name: z.string().nullable(),
  business_number: z.string().nullable(),
  normalized_business_number: z.string().nullable(),
  external_no: z.string().nullable(),
  contract_start_date: z.string().nullable(),
  grade: z.string().nullable(),
  grade_raw: z.string().nullable(),
  website: z.string().nullable(),
  ceo_name: z.string().nullable(),
  address: z.string().nullable(),
  region_group: z.string().nullable(),
  region: z.string().nullable(),
  city: z.string().nullable(),
  okestro_owner: z.string().nullable(),
  contract_contact_name: z.string().nullable(),
  contract_contact_phone: z.string().nullable(),
  contract_contact_email: z.string().nullable(),
  revenue_2023: z.string().nullable(),
  employee_count: z.string().nullable(),
  credit_rating: z.string().nullable(),
  source_file: z.string(),
  warnings: z.array(z.string())
});

const MatchPayloadSchema = z.object({
  rows: z.array(MasterRowSchema)
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = MatchPayloadSchema.parse(json);
    const supabase = createAdminClient();

    const { data, error } = await supabase.from("partners").select(
      [
        "id",
        "company_name",
        "business_number",
        "external_no",
        "contract_start_date",
        "grade",
        "grade_raw",
        "website",
        "ceo_name",
        "address",
        "region_group",
        "region",
        "city",
        "okestro_owner",
        "sales_owner",
        "contract_contact_name",
        "contract_contact_phone",
        "contract_contact_email",
        "revenue_2023",
        "employee_count",
        "credit_rating"
      ].join(", ")
    );

    if (error) {
      throw new Error(error.message);
    }

    const analysis = analyzePartnerMasterRows(
      parsed.rows,
      ((data ?? []) as unknown) as PartnerMasterDbRow[]
    );

    return NextResponse.json({
      ok: true,
      summary: analysis.summary,
      items: analysis.items
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "매칭 미리보기에 실패했습니다."
      },
      { status: 400 }
    );
  }
}
