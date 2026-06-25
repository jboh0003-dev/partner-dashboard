import { revalidatePath } from "next/cache";
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
  company_name: z.string(),
  normalized_company_name: z.string().nullable(),
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

const ImportPayloadSchema = z.object({
  file_name: z.string().min(1),
  rows: z.array(ContactRowSchema)
});

type ImportRow = z.infer<typeof ContactRowSchema>;

type RowResult = {
  company_name: string;
  status: "created" | "updated" | "skipped" | "review";
  partner_id: string | null;
  message: string | null;
};

export async function POST(request: Request) {
  const supabase = createAdminClient();
  let importJobId: string | null = null;

  try {
    const json = await request.json();
    const parsed = ImportPayloadSchema.parse(json);

    const { data: importJob, error: importJobError } = await supabase
      .from("import_jobs")
      .insert({
        import_type: "partner_contacts",
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

    const [{ data: partners, error: partnerError }, { data: contacts, error: contactError }] =
      await Promise.all([
        supabase.from("partners").select("id, company_name"),
        supabase
          .from("partner_contacts")
          .select(
            "id, partner_id, name, department, position, role_type, role_raw, email, phone, is_primary, is_contract_contact"
          )
      ]);

    if (partnerError) throw new Error(partnerError.message);
    if (contactError) throw new Error(contactError.message);

    const analysis = analyzePartnerContactRows(
      parsed.rows,
      ((partners ?? []) as unknown) as PartnerContactsPartnerRow[],
      ((contacts ?? []) as unknown) as PartnerContactsDbRow[]
    );
    const analysisMap = new Map(analysis.items.map((item) => [item.row_number, item]));

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let reviewCount = 0;
    const results: RowResult[] = [];

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
          import_type: "partner_contacts",
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
        throw new Error("담당자 저장 대상 partner_id가 없습니다.");
      }

      const payload = buildContactPayload(row);

      if (item.action === "create") {
        const shouldSetPrimary = await shouldSetPrimaryContractContact(
          supabase,
          item.matched_partner_id,
          row.is_contract_contact
        );
        if (shouldSetPrimary) {
          payload.is_primary = true;
        }

        const { error } = await supabase.from("partner_contacts").insert({
          ...payload,
          partner_id: item.matched_partner_id
        });
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

      if (!item.matched_contact_id) {
        throw new Error("업데이트 대상 contact_id가 없습니다.");
      }

      const updatePayload = { ...payload };
      const existingContact = (contacts ?? []).find((contact) => contact.id === item.matched_contact_id) as
        | PartnerContactsDbRow
        | undefined;

      if (
        row.is_contract_contact &&
        (!existingContact?.is_primary ||
          existingContact.is_contract_contact)
      ) {
        updatePayload.is_primary = true;
      }

      const { error } = await supabase
        .from("partner_contacts")
        .update(updatePayload)
        .eq("id", item.matched_contact_id);
      if (error) throw new Error(error.message);

      updatedCount += 1;
      results.push({
        company_name: row.company_name,
        status: "updated",
        partner_id: item.matched_partner_id,
        message: item.reason
      });
    }

    const finalStatus = reviewCount > 0 ? "completed_with_review" : "completed";

    const { error: updateJobError } = await supabase
      .from("import_jobs")
      .update({
        status: finalStatus,
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        review_count: reviewCount,
        error_message: null
      })
      .eq("id", importJobId);
    if (updateJobError) throw new Error(updateJobError.message);

    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/partners");
    revalidatePath("/dashboard/upload");

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
      await supabase
        .from("import_jobs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "알 수 없는 오류"
        })
        .eq("id", importJobId);
    }

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "담당자 업로드 저장에 실패했습니다."
      },
      { status: 400 }
    );
  }
}

function buildContactPayload(row: ImportRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    role_type: row.role_type,
    role_raw: row.role_raw,
    is_contract_contact: row.is_contract_contact,
    source_file: row.source_file,
    last_synced_at: new Date().toISOString()
  };

  if (row.contact_name) payload.name = row.contact_name;
  if (row.department) payload.department = row.department;
  if (row.position) payload.position = row.position;
  if (row.phone) payload.phone = row.phone;
  if (row.email) payload.email = row.email;

  return payload;
}

async function shouldSetPrimaryContractContact(
  supabase: ReturnType<typeof createAdminClient>,
  partnerId: string,
  isContractContact: boolean
): Promise<boolean> {
  if (!isContractContact) return false;

  const { data, error } = await supabase
    .from("partner_contacts")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("is_contract_contact", true)
    .eq("is_primary", true)
    .limit(1);

  if (error) throw new Error(error.message);
  return (data ?? []).length === 0;
}
