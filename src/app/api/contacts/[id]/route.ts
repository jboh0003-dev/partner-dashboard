import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchFullContact, updateFullContact } from "@/lib/contacts/contact-update-full";
import { fetchContactTrainingHistory } from "@/lib/contacts/contact-review-sync";
import { softDeletePartnerContact } from "@/lib/contacts/mutations";
import { createAdminClient } from "@/lib/supabase/admin";

// TODO(auth): 추후 admin/user 권한 적용 예정 — requireAdmin() 검증 추가

const EmailInputSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string(),
  is_primary: z.boolean().optional(),
  is_bounced: z.boolean().optional(),
  is_sendable: z.boolean().optional(),
  _delete: z.boolean().optional()
});

const PhoneInputSchema = z.object({
  id: z.string().uuid().optional(),
  phone: z.string(),
  is_primary: z.boolean().optional(),
  _delete: z.boolean().optional()
});

const RoleInputSchema = z.object({
  id: z.string().uuid().optional(),
  role_name: z.string(),
  _delete: z.boolean().optional()
});

const ContactPatchSchema = z.object({
  partner_id: z.string().uuid("파트너를 선택해 주세요.").optional(),
  name: z.string().trim().min(1, "이름은 필수입니다."),
  department: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  role_raw: z.string().nullable().optional(),
  role_type: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  is_contract_contact: z.boolean().optional().default(false),
  memo: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  review_required: z.boolean().optional(),
  review_reason: z.string().nullable().optional(),
  change_reason: z.string().nullable().optional(),
  emails: z.array(EmailInputSchema).optional(),
  phones: z.array(PhoneInputSchema).optional(),
  roles: z.array(RoleInputSchema).optional()
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const result = await fetchFullContact(supabase, id);

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 404 });
    }

    const trainingHistory = await fetchContactTrainingHistory(supabase, id);

    return NextResponse.json({
      ok: true,
      contact: result.contact,
      emails: result.emails,
      phones: result.phones,
      roles: result.roles,
      training_history: trainingHistory
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "담당자 조회 실패"
      },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = ContactPatchSchema.parse(await request.json());
    const supabase = createAdminClient();
    const result = await updateFullContact(supabase, id, body, null);

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${result.partner_id}`);
    if (result.previous_partner_id) {
      revalidatePath(`/dashboard/partners/${result.previous_partner_id}`);
    }

    return NextResponse.json({ ok: true, warnings: result.warnings });
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const trainingHistory = await fetchContactTrainingHistory(supabase, id);
    const result = await softDeletePartnerContact(supabase, id, null);

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${result.partner_id}`);

    return NextResponse.json({
      ok: true,
      soft_delete: true,
      linked_history_count: trainingHistory.length
    });
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
