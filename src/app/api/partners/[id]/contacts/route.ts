import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { writePartnerChangeLogs } from "@/lib/partners/change-log";
import {
  normalizeOptionalText,
  summarizeContractContactWarnings,
  validateEmail
} from "@/lib/partners/validators";
import { createAdminClient } from "@/lib/supabase/admin";

const ContactCreateSchema = z.object({
  name: z.string().trim().min(1, "이름은 필수입니다."),
  department: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  role_raw: z.string().nullable().optional(),
  role_type: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  is_contract_contact: z.boolean().optional().default(false),
  memo: z.string().nullable().optional(),
  change_reason: z.string().nullable().optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { id: partnerId } = await context.params;
    const body = ContactCreateSchema.parse(await request.json());
    const emailCheck = validateEmail(body.email);
    if (!emailCheck.valid) {
      return NextResponse.json({ ok: false, message: emailCheck.warning }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("id")
      .eq("id", partnerId)
      .maybeSingle();

    if (partnerError || !partner) {
      return NextResponse.json(
        { ok: false, message: partnerError?.message ?? "파트너를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const payload = {
      partner_id: partnerId,
      name: body.name.trim(),
      department: normalizeOptionalText(body.department),
      position: normalizeOptionalText(body.position),
      role_raw: normalizeOptionalText(body.role_raw),
      role_type: normalizeOptionalText(body.role_type) ?? "etc",
      email: normalizeOptionalText(body.email),
      phone: normalizeOptionalText(body.phone),
      is_contract_contact: body.is_contract_contact ?? false,
      is_primary: false,
      memo: normalizeOptionalText(body.memo),
      is_active: true,
      deleted_at: null,
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
      edited_via_dashboard_at: new Date().toISOString(),
      source_file: "dashboard-manual"
    };

    const { data: inserted, error: insertError } = await supabase
      .from("partner_contacts")
      .insert(payload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { ok: false, message: insertError?.message ?? "담당자 추가 실패" },
        { status: 400 }
      );
    }

    await writePartnerChangeLogs(supabase, partnerId, auth.userId, [
      {
        entity_type: "contact",
        entity_id: inserted.id as string,
        field_name: "created",
        old_value: null,
        new_value: body.name.trim(),
        reason: body.change_reason ?? null
      }
    ]);

    const { data: activeContacts } = await supabase
      .from("partner_contacts")
      .select("is_contract_contact")
      .eq("partner_id", partnerId)
      .eq("is_active", true)
      .is("deleted_at", null);

    const warnings = [
      ...(emailCheck.warning ? [emailCheck.warning] : []),
      ...summarizeContractContactWarnings(activeContacts ?? [])
    ];

    revalidatePath(`/dashboard/partners/${partnerId}`);

    return NextResponse.json({ ok: true, contact_id: inserted.id, warnings });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "담당자 추가 실패"
      },
      { status: 400 }
    );
  }
}
