import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeStoredPipelineFile, pipelinePreviewRows } from "@/lib/imports/pipeline-storage";

export const runtime = "nodejs";
export const maxDuration = 120;

const InputSchema = z.object({
  storage_path: z.string().min(1),
  file_name: z.string().min(1)
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return unauthorizedJson(auth.message);
  try {
    const { storage_path, file_name } = InputSchema.parse(await request.json());
    const { parsed, analysis, snapshotMeta } = await analyzeStoredPipelineFile(
      createAdminClient(), storage_path, file_name, auth.userId
    );
    const preview = pipelinePreviewRows(analysis.inventory_rows);
    return NextResponse.json({
      ok: true,
      file_name,
      inventory_sheet_name: parsed.inventory_sheet_name,
      summary_validation: parsed.summary_validation,
      snapshot_meta: snapshotMeta,
      ...analysis,
      inventory_rows: preview,
      revenue_rows: [],
      preview_count: preview.length,
      total_rows: analysis.inventory_rows.length
    });
  } catch (error) {
    return NextResponse.json({
      ok: false, message: error instanceof Error ? error.message : "분석 실패"
    }, { status: 400 });
  }
}
