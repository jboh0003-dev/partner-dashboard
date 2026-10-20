import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectUnlessAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const CompleteSchema = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  status: z.enum(["completed", "failed"]),
  document_id: z.string().uuid().nullable().optional(),
  error: z.string().nullable().optional()
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const { batchId } = await context.params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_document_verified_import_entries")
    .select(
      "sha256,partner_id,partner_name,document_type,canonical_name,source_filename,received_date,file_size,status,document_id,last_error"
    )
    .eq("batch_id", batchId)
    .order("partner_name")
    .order("document_type");

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    batch_id: batchId,
    entries: data ?? []
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ batchId: string }> }
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;

  const { batchId } = await context.params;
  const body = CompleteSchema.parse(await request.json());
  const now = new Date().toISOString();
  const supabase = createAdminClient();

  const payload =
    body.status === "completed"
      ? {
          status: "completed",
          document_id: body.document_id ?? null,
          last_error: null,
          completed_at: now
        }
      : {
          status: "failed",
          document_id: null,
          last_error: body.error?.slice(0, 1000) ?? "업로드 실패",
          completed_at: null
        };

  const { error } = await supabase
    .from("partner_document_verified_import_entries")
    .update(payload)
    .eq("batch_id", batchId)
    .eq("sha256", body.sha256);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
