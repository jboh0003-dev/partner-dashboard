import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  fetchDuplicateGroupsForAdmin,
  scanAndApplyDuplicateRules
} from "@/lib/data/document-duplicates";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const payload = await fetchDuplicateGroupsForAdmin();
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "중복 목록 조회 실패"
      },
      { status: 400 }
    );
  }
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const summary = await scanAndApplyDuplicateRules();
    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard/documents/duplicates");
    revalidatePath("/dashboard/partners", "layout");

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "중복 검사 실패"
      },
      { status: 400 }
    );
  }
}
