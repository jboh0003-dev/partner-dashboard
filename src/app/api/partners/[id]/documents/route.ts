import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import {
  checkExistingDocumentForType,
  uploadPartnerDocumentManual
} from "@/lib/documents/manual-upload";
import { createAdminClient } from "@/lib/supabase/admin";

const UploadSchema = z.object({
  document_type: z.string().min(1),
  display_name: z.string().min(1),
  contract_date: z.string().nullable().optional(),
  received_date: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  mode: z.enum(["replace", "add"]).default("replace")
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return unauthorizedJson(auth.message);

    const { id: partnerId } = await context.params;
    const url = new URL(_request.url);
    const documentType = url.searchParams.get("document_type") ?? "";
    if (!documentType) {
      return NextResponse.json({ ok: false, message: "document_type이 필요합니다." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const existing = await checkExistingDocumentForType(supabase, partnerId, documentType);
    return NextResponse.json({ ok: true, existing });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "조회 실패" },
      { status: 400 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return unauthorizedJson(auth.message);

    const { id: partnerId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const metadataRaw = formData.get("metadata");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "업로드할 파일이 없습니다." }, { status: 400 });
    }
    if (!metadataRaw) {
      return NextResponse.json({ ok: false, message: "metadata가 없습니다." }, { status: 400 });
    }

    const metadata = UploadSchema.parse(JSON.parse(String(metadataRaw)));
    const supabase = createAdminClient();

    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("id", partnerId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!partner) {
      return NextResponse.json({ ok: false, message: "파트너를 찾을 수 없습니다." }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadPartnerDocumentManual(supabase, {
      partnerId,
      documentType: metadata.document_type,
      displayName: metadata.display_name,
      contractDate: metadata.contract_date ?? null,
      receivedDate: metadata.received_date ?? null,
      note: metadata.note ?? null,
      mode: metadata.mode,
      fileName: file.name,
      fileBuffer: buffer,
      contentType: file.type || "application/octet-stream"
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
    }

    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard/partners");
    revalidatePath(`/dashboard/partners/${partnerId}`);

    return NextResponse.json({
      ok: true,
      document_id: result.document_id,
      warnings: result.warnings
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "문서 업로드 실패" },
      { status: 400 }
    );
  }
}
