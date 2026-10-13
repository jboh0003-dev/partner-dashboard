import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizePartnerDocumentDirectUpload } from "@/lib/documents/direct-upload";

export const runtime = "nodejs";

const Schema = z.object({
  document_type: z.string().min(1),
  display_name: z.string().min(1),
  original_filename: z.string().min(1),
  file_size: z.number().int().positive(),
  file_hash: z.string().regex(/^[a-f0-9]{64}$/i),
  content_type: z.string().optional().default("application/octet-stream"),
  received_date: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  storage_path: z.string().min(1)
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return unauthorizedJson(auth.message);

    const { id: partnerId } = await context.params;
    const body = Schema.parse(await request.json());
    const supabase = createAdminClient();

    const result = await finalizePartnerDocumentDirectUpload(supabase, {
      partnerId,
      documentType: body.document_type,
      displayName: body.display_name,
      originalFilename: body.original_filename,
      fileSize: body.file_size,
      fileHash: body.file_hash,
      contentType: body.content_type,
      receivedDate: body.received_date ?? null,
      note: body.note ?? null,
      storagePath: body.storage_path
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${partnerId}`);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "문서 업로드 마무리 실패"
      },
      { status: 400 }
    );
  }
}
