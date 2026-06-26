import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  try {
    const { data: target, error: targetError } = await supabase
      .from("partner_policy_documents")
      .select("id, status")
      .eq("id", id)
      .single();

    if (targetError || !target) {
      return NextResponse.json({ ok: false, message: "문서를 찾을 수 없습니다." }, { status: 404 });
    }
    if (target.status !== "active") {
      return NextResponse.json({ ok: false, message: "비활성 문서는 최신으로 설정할 수 없습니다." }, { status: 400 });
    }

    const { error: unsetError } = await supabase
      .from("partner_policy_documents")
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .eq("is_current", true);
    if (unsetError) throw new Error(unsetError.message);

    const { error: setError } = await supabase
      .from("partner_policy_documents")
      .update({ is_current: true, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (setError) throw new Error(setError.message);

    revalidatePath("/dashboard/policy");
    revalidatePath("/dashboard/chat");

    return NextResponse.json({ ok: true, document_id: id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "적용 실패" },
      { status: 400 }
    );
  }
}
