import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { cancelImportJob } from "@/lib/imports/import-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const supabase = createAdminClient();
    const job = await cancelImportJob(
      supabase,
      id,
      body.reason?.trim() || "관리자가 작업을 취소했습니다."
    );

    return NextResponse.json({
      ok: true,
      job,
      message: "작업을 취소했습니다. 이후 해당 job은 contacts를 추가/수정하지 않습니다."
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "작업 취소 실패"
      },
      { status: 400 }
    );
  }
}
