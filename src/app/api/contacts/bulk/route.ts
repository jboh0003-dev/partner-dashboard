import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deactivatePartnerContactsBulk, softDeletePartnerContactsBulk } from "@/lib/contacts/mutations";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessAdmin } from "@/lib/auth/require-admin";

const BulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "대상 담당자를 선택해 주세요."),
  action: z.enum(["deactivate", "delete"]).optional().default("deactivate")
});

export async function POST(request: Request) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  try {
    const body = BulkActionSchema.parse(await request.json());
    const supabase = createAdminClient();

    if (body.action === "delete") {
      const result = await softDeletePartnerContactsBulk(supabase, body.ids, null);
      revalidatePath("/dashboard/contacts");
      revalidatePath("/dashboard/partners");
      for (const partnerId of result.partnerIds) {
        revalidatePath(`/dashboard/partners/${partnerId}`);
      }
      return NextResponse.json({
        ok: result.errors.length === 0,
        deleted_count: result.deletedCount,
        errors: result.errors
      });
    }

    const result = await deactivatePartnerContactsBulk(supabase, body.ids, null);

    revalidatePath("/dashboard/contacts");
    revalidatePath("/dashboard/partners");
    for (const partnerId of result.partnerIds) {
      revalidatePath(`/dashboard/partners/${partnerId}`);
    }

    return NextResponse.json({
      ok: result.errors.length === 0,
      deactivated_count: result.deactivatedCount,
      errors: result.errors
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "일괄 삭제 실패"
      },
      { status: 400 }
    );
  }
}
