import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessAdmin } from "@/lib/auth/require-admin";
import { readPartnerStorageBudget, requirePartnerStorageBudget } from "@/lib/storage/upload-budget";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { isSafeStorageObjectKey } from "@/lib/documents/storage-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optimizable = new Set(["pdf", "jpg", "jpeg", "pptx", "docx"]);
const Prepare = z.object({
  document_id: z.string().uuid(),
  file_size: z.number().int().positive().max(25 * 1024 * 1024)
});

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function checkOtherDocumentReferences(
  supabase: ReturnType<typeof createAdminClient>,
  sourcePath: string,
  documentId: string
): Promise<void> {
  const [storageRefs, fileRefs] = await Promise.all([
    supabase.from("partner_documents")
      .select("id").eq("storage_path", sourcePath).neq("id", documentId).limit(1),
    supabase.from("partner_documents")
      .select("id").eq("file_path", sourcePath).neq("id", documentId).limit(1)
  ]);
  if (storageRefs.error || fileRefs.error) {
    throw new Error("원본 참조 확인에 실패해 교체를 중단했습니다.");
  }
  if ((storageRefs.data?.length ?? 0) > 0 || (fileRefs.data?.length ?? 0) > 0) {
    throw new Error("다른 문서 이력이 원본을 참조하므로 안전한 교체 대상에서 제외했습니다.");
  }
}

export async function GET() {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  try {
    const supabase = createAdminClient();
    const [docResult, budget] = await Promise.all([
      supabase.from("partner_documents")
        .select("id,partner_id,document_type,original_filename,file_size,file_ext,storage_path,file_path,file_hash")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("file_size", { ascending: false })
        .limit(1000),
      readPartnerStorageBudget(supabase)
    ]);
    if (docResult.error) throw new Error(docResult.error.message);
    const candidates = (docResult.data ?? [])
      .map((d) => ({
        id: String(d.id),
        document_type: String(d.document_type ?? "other"),
        original_filename: String(d.original_filename ?? "document"),
        file_size: Number(d.file_size ?? 0),
        extension: String(d.file_ext ?? extOf(String(d.original_filename ?? ""))).toLowerCase(),
        optimizable: optimizable.has(String(d.file_ext ?? extOf(String(d.original_filename ?? ""))).toLowerCase()),
        has_storage_path: Boolean(d.storage_path ?? d.file_path)
      }))
      .filter((d) => d.file_size > 0 && d.has_storage_path);
    return NextResponse.json({ ok: true, candidates, budget }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "진단 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  try {
    const input = Prepare.parse(await request.json());
    const supabase = createAdminClient();
    const { data: doc, error } = await supabase.from("partner_documents")
      .select("id,partner_id,document_type,original_filename,file_size,file_ext,storage_path,file_path")
      .eq("id", input.document_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !doc) throw new Error(error?.message ?? "기존 문서를 찾지 못했습니다.");
    const ext = String(doc.file_ext ?? extOf(String(doc.original_filename ?? ""))).toLowerCase();
    if (!optimizable.has(ext)) throw new Error("이 형식은 안전한 브라우저 압축을 지원하지 않습니다.");
    if (input.file_size > Number(doc.file_size) * 0.96) {
      throw new Error("최소 4% 이상 작아진 문서만 교체할 수 있습니다.");
    }
    const sourcePath = String(doc.storage_path ?? doc.file_path ?? "");
    if (!sourcePath || !isSafeStorageObjectKey(sourcePath)) {
      throw new Error("기존 문서 경로가 유효하지 않아 안전한 교체를 실행할 수 없습니다.");
    }
    await checkOtherDocumentReferences(supabase, sourcePath, input.document_id);
    await requirePartnerStorageBudget(supabase, input.file_size);
    const path = String(doc.partner_id) + "/" + String(doc.document_type) +
      "/optimized-" + crypto.randomUUID() + "." + ext;
    if (!isSafeStorageObjectKey(path)) throw new Error("Storage 경로 검증 실패");
    const { data, error: signedError } = await supabase.storage
      .from(PARTNER_DOCUMENTS_BUCKET).createSignedUploadUrl(path);
    if (signedError || !data?.token) throw new Error(signedError?.message ?? "업로드 URL 생성 실패");
    return NextResponse.json({ ok: true, path, token: data.token });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "압축본 업로드 준비 실패" }, { status: 400 });
  }
}
