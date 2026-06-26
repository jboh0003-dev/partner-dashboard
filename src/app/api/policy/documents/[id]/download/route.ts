import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PARTNER_POLICY_BUCKET } from "@/lib/policy/constants";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = createAdminClient();

  const { data: document, error } = await supabase
    .from("partner_policy_documents")
    .select("storage_path, source_file_name, file_type")
    .eq("id", id)
    .single();

  if (error || !document) {
    return NextResponse.json({ ok: false, message: "문서를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(PARTNER_POLICY_BUCKET)
    .createSignedUrl(document.storage_path, 60 * 30);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ ok: false, message: "다운로드 URL 생성 실패" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
