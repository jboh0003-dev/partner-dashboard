import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { mergeContactsIntoMaster } from "@/lib/contacts/contact-merge";
import { softDeletePartnerContact } from "@/lib/contacts/mutations";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ReviewActionSchema = z.object({
  action: z.enum(["keep_active", "deactivate", "merge", "delete"]),
  merge_target_id: z.string().uuid().optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const json = await request.json();
    const parsed = ReviewActionSchema.parse(json);
    const supabase = createAdminClient();
    const userClient = await createClient();
    const {
      data: { user }
    } = await userClient.auth.getUser();

    if (parsed.action === "keep_active") {
      const { error } = await supabase
        .from("partner_contacts")
        .update({
          review_required: false,
          review_reason: null,
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else if (parsed.action === "deactivate") {
      const { error } = await supabase
        .from("partner_contacts")
        .update({
          is_active: false,
          in_current_full_db: false,
          review_required: false,
          review_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    } else if (parsed.action === "merge") {
      if (!parsed.merge_target_id) {
        return NextResponse.json({ ok: false, message: "병합 대상 contact_id가 필요합니다." }, { status: 400 });
      }
      await mergeContactsIntoMaster(supabase, parsed.merge_target_id, [id], "review_merge");
      await supabase
        .from("partner_contacts")
        .update({ review_required: false, review_reason: null })
        .eq("id", parsed.merge_target_id);
    } else if (parsed.action === "delete") {
      const result = await softDeletePartnerContact(supabase, id, user?.id ?? null);
      if (!result.ok) throw new Error(result.message);
    }

    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/contacts/review");

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "처리에 실패했습니다." },
      { status: 400 }
    );
  }
}
