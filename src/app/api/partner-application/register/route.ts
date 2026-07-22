import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parsePartnerContractGrade,
  type PartnerContractGrade
} from "@/lib/partner-application/contract-dates";
import { registerPartnerApplication } from "@/lib/partner-application/register";
import type { ApplicationPerson } from "@/lib/partner-application/parse-application";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

const PersonSchema = z.object({
  section: z.enum(["contract_contact", "sales", "engineer"]),
  duty: z.string().nullable(),
  department: z.string().nullable(),
  name: z.string(),
  position: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  note: z.string().nullable(),
  skill_level: z.string().nullable(),
  main_skills: z.string().nullable(),
  excluded: z.boolean().optional()
});

const PayloadSchema = z.object({
  company: z.object({
    company_name_db: z.string().min(1),
    company_name_contract: z.string(),
    business_number: z.string().nullable(),
    ceo_name: z.string().nullable(),
    website: z.string().nullable(),
    founded_date: z.string().nullable(),
    credit_rating: z.string().nullable(),
    address: z.string().nullable(),
    revenue: z.string().nullable(),
    employee_count: z.string().nullable(),
    engineer_count: z.string().nullable(),
    dedicated_sales_count: z.string().nullable(),
    dedicated_engineer_count: z.string().nullable()
  }),
  grade: z.string(),
  contract_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  people: z.array(PersonSchema),
  existing_partner_id: z.string().uuid().nullable().optional(),
  update_fields: z.array(z.string()).optional()
});

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const payloadRaw = form.get("payload");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "신청서 원본 파일이 필요합니다." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ ok: false, message: "Excel(.xlsx)만 저장할 수 있습니다." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, message: "파일 크기는 10MB를 초과할 수 없습니다." }, { status: 400 });
    }
    if (typeof payloadRaw !== "string") {
      return NextResponse.json({ ok: false, message: "등록 payload가 필요합니다." }, { status: 400 });
    }

    const parsedPayload = PayloadSchema.parse(JSON.parse(payloadRaw));
    const grade = parsePartnerContractGrade(parsedPayload.grade);
    if (!grade) {
      return NextResponse.json(
        { ok: false, message: "계약등급은 실버/골드/플래티넘만 지원합니다." },
        { status: 400 }
      );
    }

    const people = parsedPayload.people as ApplicationPerson[];
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const supabase = createAdminClient();

    const result = await registerPartnerApplication(supabase, {
      company: parsedPayload.company,
      grade: grade as PartnerContractGrade,
      contractStartDate: parsedPayload.contract_start_date,
      people,
      fileName: file.name,
      fileBuffer,
      contentType: file.type,
      existingPartnerId: parsedPayload.existing_partner_id ?? null,
      updateFields: parsedPayload.update_fields
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${result.partner_id}`);
    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/documents");

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "파트너 신청서 등록 실패";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
