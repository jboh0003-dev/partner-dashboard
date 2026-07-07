import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { reprocessPolicyDocumentChunks } from "@/lib/policy/reprocess-document";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const result = await reprocessPolicyDocumentChunks(supabase, id);

    revalidatePath("/dashboard/policy");
    revalidatePath("/dashboard/policy/upload");
    revalidatePath("/dashboard/chat");

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "재처리 실패" },
      { status: 400 }
    );
  }
}
