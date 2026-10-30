import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { readPartnerStorageBudget } from "@/lib/storage/upload-budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }
  try {
    const budget = await readPartnerStorageBudget(createAdminClient());
    return NextResponse.json({ ok: true, ...budget }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "사용량 조회 실패" },
      { status: 503 }
    );
  }
}
