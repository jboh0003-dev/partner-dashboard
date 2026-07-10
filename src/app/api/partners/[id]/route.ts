import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { collectFieldChanges, writePartnerChangeLogs } from "@/lib/partners/change-log";
import {
  buildPartnerGradeSavePayload,
  normalizePartnerGrade
} from "@/lib/partners/grade";
import { softDeletePartners } from "@/lib/partners/mutations";
import { normalizeOptionalText, validateContractDate } from "@/lib/partners/validators";
import { createAdminClient } from "@/lib/supabase/admin";

const PartnerPatchSchema = z.object({
  company_name: z.string().trim().min(1, "회사명은 필수입니다."),
  external_no: z.string().nullable().optional(),
  contract_start_date: z.string().nullable().optional(),
  grade: z.string().nullable().optional(),
  grade_override: z.string().nullable().optional(),
  grade_raw: z.string().nullable().optional(),
  grade_change_raw: z.string().nullable().optional(),
  region_group: z.string().nullable().optional(),
  sales_owner: z.string().nullable().optional(),
  business_number: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  main_phone: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  change_reason: z.string().nullable().optional()
});

const PARTNER_LOG_FIELDS = [
  "company_name",
  "external_no",
  "contract_start_date",
  "grade",
  "grade_override",
  "grade_raw",
  "grade_change_raw",
  "region_group",
  "sales_owner",
  "business_number",
  "website",
  "address",
  "main_phone",
  "memo"
] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { id } = await context.params;
    const body = PartnerPatchSchema.parse(await request.json());
    const contractDateCheck = validateContractDate(body.contract_start_date);
    if (!contractDateCheck.valid) {
      return NextResponse.json(
        { ok: false, message: contractDateCheck.message ?? "계약일자 형식 오류" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("partners")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json(
        { ok: false, message: fetchError?.message ?? "파트너를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const gradeSave = buildPartnerGradeSavePayload(body.grade ?? body.grade_override);
    let gradeChangeRaw = normalizeOptionalText(body.grade_change_raw ?? body.grade_raw);

    // 대시보드에서 등급을 직접 선택한 경우, Excel change_raw가 다른 등급으로 덮어쓰지 않도록 정리
    if (gradeSave.grade) {
      const changeToken = normalizePartnerGrade(gradeChangeRaw);
      if (changeToken && changeToken !== gradeSave.grade) {
        gradeChangeRaw = null;
      }
    }

    const payload = {
      company_name: body.company_name.trim(),
      external_no: normalizeOptionalText(body.external_no),
      contract_start_date: normalizeOptionalText(body.contract_start_date),
      grade: gradeSave.grade,
      grade_override: gradeSave.grade_override,
      grade_change_raw: gradeChangeRaw,
      grade_raw: gradeChangeRaw,
      region_group: normalizeOptionalText(body.region_group),
      sales_owner: normalizeOptionalText(body.sales_owner),
      business_number: normalizeOptionalText(body.business_number),
      website: normalizeOptionalText(body.website),
      address: normalizeOptionalText(body.address),
      main_phone: normalizeOptionalText(body.main_phone),
      memo: normalizeOptionalText(body.memo),
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
      edited_via_dashboard_at: new Date().toISOString()
    };

    const { data: updated, error: updateError } = await supabase
      .from("partners")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (updateError || !updated) {
      return NextResponse.json(
        { ok: false, message: updateError?.message ?? "업데이트 실패" },
        { status: 400 }
      );
    }

    const changes = collectFieldChanges(existing, { ...existing, ...payload, id }, [
      ...PARTNER_LOG_FIELDS
    ]).map((entry) => ({
      ...entry,
      reason: body.change_reason ?? null
    }));

    await writePartnerChangeLogs(supabase, id, auth.userId, changes);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${id}`);

    return NextResponse.json({ ok: true, partner: updated });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "파트너 수정 실패"
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const result = await softDeletePartners(supabase, [id], auth.userId);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { ok: false, message: result.errors[0] ?? "파트너를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${id}`);
    revalidatePath("/dashboard/contacts");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "파트너 삭제 실패"
      },
      { status: 400 }
    );
  }
}
