import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { deactivatePartnerContact } from "@/lib/contacts/mutations";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const result = await deactivatePartnerContact(supabase, id, null);

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${result.partner_id}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "비활성화 실패"
      },
      { status: 400 }
    );
  }
}
