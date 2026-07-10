import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { collectContactFieldChanges, writePartnerChangeLogs } from "@/lib/partners/change-log";
import {
  normalizeOptionalText,
  summarizeContractContactWarnings,
  validateEmail
} from "@/lib/partners/validators";
import { createAdminClient } from "@/lib/supabase/admin";

const ContactPatchSchema = z.object({
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

const CONTACT_LOG_FIELDS = [
  "name",
  "department",
  "position",
  "role_raw",
  "role_type",
  "email",
  "phone",
  "is_contract_contact",
  "memo"
] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; contactId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { id: partnerId, contactId } = await context.params;
    const body = ContactPatchSchema.parse(await request.json());
    const emailCheck = validateEmail(body.email);
    if (!emailCheck.valid) {
      return NextResponse.json({ ok: false, message: emailCheck.warning }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("partner_contacts")
      .select("*")
      .eq("id", contactId)
      .eq("partner_id", partnerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json(
        { ok: false, message: fetchError?.message ?? "담당자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const payload = {
      name: body.name.trim(),
      department: normalizeOptionalText(body.department),
      position: normalizeOptionalText(body.position),
      role_raw: normalizeOptionalText(body.role_raw),
      role_type: normalizeOptionalText(body.role_type) ?? existing.role_type ?? "etc",
      email: normalizeOptionalText(body.email),
      phone: normalizeOptionalText(body.phone),
      is_contract_contact: body.is_contract_contact ?? false,
      memo: normalizeOptionalText(body.memo),
      updated_at: new Date().toISOString(),
      updated_by: auth.userId,
      edited_via_dashboard_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from("partner_contacts")
      .update(payload)
      .eq("id", contactId);

    if (updateError) {
      return NextResponse.json({ ok: false, message: updateError.message }, { status: 400 });
    }

    const changes = collectContactFieldChanges(
      contactId,
      existing,
      { ...existing, ...payload },
      [...CONTACT_LOG_FIELDS]
    ).map((entry) => ({
      ...entry,
      reason: body.change_reason ?? null
    }));

    await writePartnerChangeLogs(supabase, partnerId, auth.userId, changes);

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

    return NextResponse.json({ ok: true, warnings });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "담당자 수정 실패"
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; contactId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { id: partnerId, contactId } = await context.params;
    const supabase = createAdminClient();

    const { data: existing, error: fetchError } = await supabase
      .from("partner_contacts")
      .select("id, name, is_active")
      .eq("id", contactId)
      .eq("partner_id", partnerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json(
        { ok: false, message: fetchError?.message ?? "담당자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const { error: updateError } = await supabase
      .from("partner_contacts")
      .update({
        is_active: false,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: auth.userId,
        edited_via_dashboard_at: new Date().toISOString()
      })
      .eq("id", contactId);

    if (updateError) {
      return NextResponse.json({ ok: false, message: updateError.message }, { status: 400 });
    }

    await writePartnerChangeLogs(supabase, partnerId, auth.userId, [
      {
        entity_type: "contact",
        entity_id: contactId,
        field_name: "deleted",
        old_value: String(existing.name),
        new_value: null
      }
    ]);

    revalidatePath(`/dashboard/partners/${partnerId}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "담당자 삭제 실패"
      },
      { status: 400 }
    );
  }
}
