import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const UpdateSchema = z.object({
  display_name: z.string().min(1).optional(),
  document_type: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  hidden: z.boolean().optional()
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = UpdateSchema.parse(await request.json());
    const supabase = createAdminClient();

    const payload: Record<string, unknown> = {};
    if (body.display_name !== undefined) {
      payload.display_name = body.display_name;
      payload.file_name = body.display_name;
    }
    if (body.document_type !== undefined) payload.document_type = body.document_type;
    if (body.note !== undefined) {
      payload.note = body.note;
      payload.summary = body.note;
    }
    if (body.hidden !== undefined) {
      payload.deleted_at = body.hidden ? new Date().toISOString() : null;
      payload.document_status = body.hidden ? "hidden" : "active";
    }

    const { data, error } = await supabase
      .from("partner_documents")
      .update(payload)
      .eq("id", id)
      .select("partner_id")
      .single();

    if (error || !data) {
      return NextResponse.json({ ok: false, message: error?.message ?? "수정 실패" }, { status: 400 });
    }

    revalidatePath("/dashboard/documents");
    revalidatePath(`/dashboard/partners/${data.partner_id}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "문서 수정 실패"
      },
      { status: 400 }
    );
  }
}
