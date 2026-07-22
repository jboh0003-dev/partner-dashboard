import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createPartnerContact } from "@/lib/contacts/mutations";
import { createAdminClient } from "@/lib/supabase/admin";

const ContactCreateSchema = z.object({
  partner_id: z.string().uuid("파트너를 선택해 주세요."),
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

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return unauthorizedJson(auth.message);

    const body = ContactCreateSchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("id", body.partner_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!partner) {
      return NextResponse.json({ ok: false, message: "파트너를 찾을 수 없습니다." }, { status: 404 });
    }

    const result = await createPartnerContact(supabase, body.partner_id, body, null);
    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${body.partner_id}`);

    return NextResponse.json({
      ok: true,
      contact_id: result.contact_id,
      warnings: result.warnings
    });
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
