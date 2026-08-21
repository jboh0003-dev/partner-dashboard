import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllCanonicalContacts, fetchAllPartners } from "@/lib/imports/fetch-all-rows";
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

/** 분석/미리보기 — read-only. partners / partner_contacts를 변경하지 않는다. */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = MatchPayloadSchema.parse(json);
    const supabase = createAdminClient();

    const [partners, contacts] = await Promise.all([
      fetchAllPartners(supabase),
      fetchAllCanonicalContacts(supabase)
    ]);

    const contactIds = (contacts as Array<{ id?: unknown }>)
      .map((c) => String(c.id ?? ""))
      .filter(Boolean);
    const historyContactIds = new Set<string>();
    for (let i = 0; i < contactIds.length; i += 200) {
      const chunk = contactIds.slice(i, i + 200);
      const { data: trainingLinks } = await supabase
        .from("training_attendance")
        .select("contact_id")
        .in("contact_id", chunk)
        .not("contact_id", "is", null);
      for (const row of trainingLinks ?? []) {
        if (row.contact_id) historyContactIds.add(String(row.contact_id));
      }
    }

    const analysis = analyzePartnerContactRows(
      parsed.rows,
      partners as unknown as PartnerContactsPartnerRow[],
      contacts as unknown as PartnerContactsDbRow[],
      historyContactIds
    );

    return NextResponse.json({
      ok: true,
      summary: analysis.summary,
      items: analysis.items,
      baselineExcluded: analysis.baselineExcluded,
      historyOnlyPreserved: analysis.historyOnlyPreserved,
      alreadyInactive: analysis.alreadyInactive,
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
