import { revalidatePath } from "next/cache";
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
  grade_original: z.string().nullable(),
  grade_change_raw: z.string().nullable(),
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

const ImportPayloadSchema = z.object({
  file_name: z.string().min(1),
  rows: z.array(MasterRowSchema),
  upload_mode: z.enum(["update", "full_sync"]).optional().default("update")
});

type ImportRow = z.infer<typeof MasterRowSchema>;

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
        import_type: "partner_master_upload",
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

    const { data: partnerData, error: partnerError } = await supabase
      .from("partners")
      .select(
        [
          "id",
          "company_name",
          "business_number",
          "external_no",
          "contract_start_date",
          "grade",
          "grade_original",
          "grade_change_raw",
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
          "credit_rating",
          "edited_via_dashboard_at",
          "deleted_at",
          "is_active"
        ].join(", ")
      )
      .is("deleted_at", null);

    if (partnerError) {
      throw new Error(partnerError.message);
    }

    const analysis = analyzePartnerMasterRows(
      parsed.rows,
      ((partnerData ?? []) as unknown) as PartnerMasterDbRow[],
      { uploadMode: parsed.upload_mode }
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
          import_type: "partner_master_upload",
          row_number: row.row_number,
          company_name: row.company_name,
          reason: item.reason,
          raw_data: row,
          status: "pending"
        });
        if (error) {
          throw new Error(error.message);
        }
        results.push({
          company_name: row.company_name,
          status: "review",
          partner_id: null,
          message: item.reason
        });
        continue;
      }

      const payload = buildPartnerPayload(row);

      if (item.action === "create") {
        const { data, error } = await supabase
          .from("partners")
          .insert(payload)
          .select("id")
          .single();

        if (error || !data) {
          throw new Error(error?.message ?? "partner create 실패");
        }

        await upsertContractContact(supabase, data.id as string, row);

        createdCount += 1;
        results.push({
          company_name: row.company_name,
          status: "created",
          partner_id: data.id as string,
          message: item.reason
        });
        continue;
      }

      if (!item.matched_partner_id) {
        throw new Error("update 대상 partner_id가 없습니다.");
      }

      const { error } = await supabase
        .from("partners")
        .update(payload)
        .eq("id", item.matched_partner_id);

      if (error) {
        throw new Error(error.message);
      }

      await upsertContractContact(supabase, item.matched_partner_id, row);

      updatedCount += 1;
      results.push({
        company_name: row.company_name,
        status: "updated",
        partner_id: item.matched_partner_id,
        message: item.reason
      });
    }

    const finalStatus = results.some((row) => row.status === "review") ? "completed_with_review" : "completed";

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

    if (updateJobError) {
      throw new Error(updateJobError.message);
    }

    revalidatePath("/dashboard/partners", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/upload");

    return NextResponse.json({
      ok: true,
      summary: {
        total: parsed.rows.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        review: reviewCount,
        errors: 0,
        missing_from_excel: analysis.summary.missing_from_excel
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
        message: error instanceof Error ? error.message : "파트너 기본정보 저장에 실패했습니다."
      },
      { status: 400 }
    );
  }
}

function buildPartnerPayload(row: ImportRow): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    company_name: row.company_name,
    source_file: row.source_file,
    last_synced_at: new Date().toISOString()
  };

  if (row.external_no) payload.external_no = row.external_no;
  if (row.contract_start_date) payload.contract_start_date = row.contract_start_date;
  if (row.grade) payload.grade = row.grade;
  if (row.grade_original) payload.grade_original = row.grade_original;
  if (row.grade_change_raw) payload.grade_change_raw = row.grade_change_raw;
  if (row.grade_change_raw ?? row.grade_original) {
    payload.grade_raw = row.grade_change_raw ?? row.grade_original;
  } else if (row.grade_raw) {
    payload.grade_raw = row.grade_raw;
  }
  if (row.business_number) payload.business_number = row.business_number;
  if (row.website) payload.website = row.website;
  if (row.ceo_name) payload.ceo_name = row.ceo_name;
  if (row.address) payload.address = row.address;
  if (row.region_group) payload.region_group = row.region_group;
  if (row.region) payload.region = row.region;
  if (row.city) payload.city = row.city;
  if (row.okestro_owner) {
    payload.okestro_owner = row.okestro_owner;
    payload.sales_owner = row.okestro_owner;
  }
  if (row.contract_contact_name) payload.contract_contact_name = row.contract_contact_name;
  if (row.contract_contact_phone) payload.contract_contact_phone = row.contract_contact_phone;
  if (row.contract_contact_email) payload.contract_contact_email = row.contract_contact_email;
  if (row.revenue_2023) payload.revenue_2023 = row.revenue_2023;
  if (row.employee_count) payload.employee_count = row.employee_count;
  if (row.credit_rating) payload.credit_rating = row.credit_rating;

  return payload;
}

async function upsertContractContact(
  supabase: ReturnType<typeof createAdminClient>,
  partnerId: string,
  row: ImportRow
) {
  if (!row.contract_contact_name && !row.contract_contact_phone && !row.contract_contact_email) {
    return;
  }

  const { data: existingContacts, error: loadError } = await supabase
    .from("partner_contacts")
    .select("id, name, phone, email")
    .eq("partner_id", partnerId)
    .eq("is_contract_contact", true);

  if (loadError) {
    throw new Error(loadError.message);
  }

  const matched = (existingContacts ?? []).find((contact) => {
    if (row.contract_contact_email && contact.email === row.contract_contact_email) return true;
    if (row.contract_contact_phone && contact.phone === row.contract_contact_phone) return true;
    if (row.contract_contact_name && contact.name === row.contract_contact_name) return true;
    return false;
  });

  const payload: Record<string, unknown> = {
    partner_id: partnerId,
    role_type: "contract",
    role_raw: "계약담당자",
    is_contract_contact: true,
    is_primary: true,
    source_file: row.source_file,
    last_synced_at: new Date().toISOString()
  };

  if (row.contract_contact_name) payload.name = row.contract_contact_name;
  if (row.contract_contact_phone) payload.phone = row.contract_contact_phone;
  if (row.contract_contact_email) payload.email = row.contract_contact_email;

  if (matched) {
    const { error } = await supabase
      .from("partner_contacts")
      .update(payload)
      .eq("id", matched.id);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const { error } = await supabase.from("partner_contacts").insert(payload);
  if (error) {
    throw new Error(error.message);
  }
}
