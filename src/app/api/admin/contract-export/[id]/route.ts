import { NextResponse } from "next/server";
import { requireAdmin, forbiddenJson } from "@/lib/auth/require-admin";
import { unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchContractStatusExportRows } from "@/lib/partners/contract-status-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.status === 401 ? unauthorizedJson(auth.message) : forbiddenJson(auth.message);
  }
  if (!auth.userId) return unauthorizedJson("로그인이 필요합니다.");

  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("contract_export_enabled")
    .eq("id", auth.userId)
    .maybeSingle();

  if (profileError || profile?.contract_export_enabled !== true) {
    return forbiddenJson("계약현황 추출 권한이 없습니다.");
  }

  const { id } = await context.params;
  const rows = await fetchContractStatusExportRows(supabase, id);
  const row = rows[0] ?? null;

  if (!row) {
    return NextResponse.json({ ok: false, message: "파트너를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, row },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
