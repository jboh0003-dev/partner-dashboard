import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { deletePartnerDocumentHard } from "@/lib/documents/document-lifecycle";
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
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

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

    const { data: existing } = await supabase
      .from("partner_documents")
      .select("partner_id")
      .eq("id", id)
      .maybeSingle();

    const result = await deletePartnerDocumentHard(supabase, id);

    if (!result.ok) {
      console.error("[document-delete] failed", { documentId: id, errors: result.errors, deletedStorage: result.deletedStorage });
      return NextResponse.json(
        { ok: false, message: result.errors.join(" / ") || "삭제 실패" },
        { status: 400 }
      );
    }

    if (result.errors.length > 0) {
      console.warn("[document-delete] partial warnings", { documentId: id, errors: result.errors });
    }

    revalidatePath("/dashboard/documents");
    if (existing?.partner_id) {
      revalidatePath(`/dashboard/partners/${existing.partner_id}`);
    }

    return NextResponse.json({
      ok: true,
      deleted_storage: result.deletedStorage,
      warnings: result.errors
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "문서 삭제 실패"
      },
      { status: 400 }
    );
  }
}
