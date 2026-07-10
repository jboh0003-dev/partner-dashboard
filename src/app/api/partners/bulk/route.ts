import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { softDeletePartners } from "@/lib/partners/mutations";
import { createAdminClient } from "@/lib/supabase/admin";

const BulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "삭제할 파트너를 선택해 주세요.")
});

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const body = BulkDeleteSchema.parse(await request.json());
    const supabase = createAdminClient();
    const result = await softDeletePartners(supabase, body.ids, auth.userId);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/partners");
    revalidatePath("/dashboard/contacts");
    for (const id of result.deletedIds) {
      revalidatePath(`/dashboard/partners/${id}`);
    }

    return NextResponse.json({
      ok: result.errors.length === 0 || result.deletedCount > 0,
      deleted_count: result.deletedCount,
      deleted_ids: result.deletedIds,
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
