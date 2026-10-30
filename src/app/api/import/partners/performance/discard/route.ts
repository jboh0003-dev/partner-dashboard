import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEMP_IMPORTS_BUCKET } from "@/lib/imports/import-logs";
import { assertPipelineStoragePath } from "@/lib/imports/pipeline-storage";

const Schema = z.object({ storage_path: z.string().min(1) });
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return unauthorizedJson(auth.message);
  try {
    const { storage_path } = Schema.parse(await request.json());
    const path = assertPipelineStoragePath(storage_path, auth.userId);
    const { error } = await createAdminClient().storage.from(TEMP_IMPORTS_BUCKET).remove([path]);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({
      ok: false, message: error instanceof Error ? error.message : "임시 파일 정리 실패"
    }, { status: 400 });
  }
}
