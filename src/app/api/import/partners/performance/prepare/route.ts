import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEMP_IMPORTS_BUCKET } from "@/lib/imports/import-logs";
import { requirePartnerStorageBudget } from "@/lib/storage/upload-budget";
import { MAX_PIPELINE_IMPORT_BYTES, validatePipelineImportName } from "@/lib/imports/pipeline-storage";

export const runtime = "nodejs";

const InputSchema = z.object({
  file_name: z.string().min(1).max(300),
  file_size: z.number().int().positive().max(MAX_PIPELINE_IMPORT_BYTES)
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return unauthorizedJson(auth.message);
  try {
    const input = InputSchema.parse(await request.json());
    const extension = validatePipelineImportName(input.file_name);
    const supabase = createAdminClient();
    const prefix = "partner_pipeline/" + auth.userId;
    // Reclaim abandoned uploads after 24h; do not touch recent in-progress files.
    const { data: staleCandidates } = await supabase.storage
      .from(TEMP_IMPORTS_BUCKET).list(prefix, { limit: 100 });
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const stalePaths = (staleCandidates ?? [])
      .filter((item) =>
        item.name &&
        /\.(xlsx|xls)$/i.test(item.name) &&
        item.created_at &&
        new Date(item.created_at).getTime() < cutoff
      )
      .map((item) => prefix + "/" + item.name);
    if (stalePaths.length) {
      await supabase.storage.from(TEMP_IMPORTS_BUCKET).remove(stalePaths);
    }
    await requirePartnerStorageBudget(supabase, input.file_size);
    const path = prefix + "/" + crypto.randomUUID() + "." + extension;
    const { data, error } = await supabase.storage
      .from(TEMP_IMPORTS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message ?? "보안 업로드 경로 발급에 실패했습니다.");
    return NextResponse.json({ ok: true, path, token: data.token });
  } catch (error) {
    return NextResponse.json({
      ok: false, message: error instanceof Error ? error.message : "업로드 준비 실패"
    }, { status: 400 });
  }
}
