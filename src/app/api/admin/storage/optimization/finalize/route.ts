import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessAdmin } from "@/lib/auth/require-admin";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { isSafeStorageObjectKey } from "@/lib/documents/storage-path";
import { readPartnerStorageBudget } from "@/lib/storage/upload-budget";

export const runtime = "nodejs";
export const maxDuration = 120;

const Schema = z.object({
  document_id: z.string().uuid(),
  path: z.string().min(1),
  file_size: z.number().int().positive(),
  file_hash: z.string().regex(/^[0-9a-f]{64}$/i)
});
function hash(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}
function ext(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function assertExclusiveSource(
  supabase: ReturnType<typeof createAdminClient>,
  documentId: string,
  sourcePath: string
): Promise<void> {
  const [a, b] = await Promise.all([
    supabase.from("partner_documents").select("id")
      .eq("storage_path", sourcePath).neq("id", documentId).limit(1),
    supabase.from("partner_documents").select("id")
      .eq("file_path", sourcePath).neq("id", documentId).limit(1)
  ]);
  if (a.error || b.error || a.data?.length || b.data?.length) {
    throw new Error("원본을 참조하는 다른 이력이 확인되어 교체를 보류했습니다.");
  }
}

async function isStructurallyCompatible(
  extension: string, before: Buffer, after: Buffer
): Promise<boolean> {
  if (extension === "pdf") {
    // Digital signatures and encrypted PDFs are NEVER rewritten.
    if (/\/ByteRange\s*\[|\/Type\s*\/Sig\b/.test(before.subarray(0, 1048576).toString("latin1"))) return false;
    try {
      const source = await PDFDocument.load(new Uint8Array(before), { updateMetadata: false });
      const result = await PDFDocument.load(new Uint8Array(after), { updateMetadata: false });
      return source.getPageCount() === result.getPageCount();
    } catch { return false; }
  }
  if (extension === "pptx" || extension === "docx") {
    try {
      const [a, b] = await Promise.all([JSZip.loadAsync(before), JSZip.loadAsync(after)]);
      const pathsA = Object.keys(a.files).sort();
      const pathsB = Object.keys(b.files).sort();
      if (pathsA.length !== pathsB.length || pathsA.some((p, i) => p !== pathsB[i])) return false;
      for (const path of pathsA) {
        if (a.files[path].dir || /^(?:ppt|word)\/media\/[^/]+\.jpe?g$/i.test(path)) continue;
        const [v1, v2] = await Promise.all([a.files[path].async("uint8array"), b.files[path].async("uint8array")]);
        if (hash(Buffer.from(v1)) !== hash(Buffer.from(v2))) return false;
      }
      return true;
    } catch { return false; }
  }
  return extension === "jpg" || extension === "jpeg";
}

export async function POST(request: Request) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  try {
    const input = Schema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: doc, error: docError } = await supabase.from("partner_documents")
      .select("id,partner_id,document_type,original_filename,file_size,file_hash,storage_path,file_path,file_ext")
      .eq("id", input.document_id).eq("is_active", true).is("deleted_at", null).maybeSingle();
    if (docError || !doc) throw new Error(docError?.message ?? "문서를 찾지 못했습니다.");
    const sourcePath = String(doc.storage_path ?? doc.file_path ?? "");
    const extension = String(doc.file_ext ?? ext(String(doc.original_filename ?? ""))).toLowerCase();
    const expectedPrefix = String(doc.partner_id) + "/" + String(doc.document_type) + "/optimized-";
    if (!isSafeStorageObjectKey(input.path) || !input.path.startsWith(expectedPrefix) ||
        !input.path.endsWith("." + extension) || !/optimized-[0-9a-f-]{36}\./.test(input.path)) {
      throw new Error("허용되지 않는 압축본 Storage 경로입니다.");
    }
    if (!sourcePath || input.path === sourcePath) throw new Error("원본 경로를 보호할 수 없습니다.");

    const bucket = supabase.storage.from(PARTNER_DOCUMENTS_BUCKET);
    const [origResponse, newResponse] = await Promise.all([
      bucket.download(sourcePath), bucket.download(input.path)
    ]);
    if (!origResponse.data || !newResponse.data || origResponse.error || newResponse.error) {
      throw new Error("원본 또는 압축본을 다운로드할 수 없어 교체를 취소했습니다.");
    }
    const before = Buffer.from(await origResponse.data.arrayBuffer());
    const after = Buffer.from(await newResponse.data.arrayBuffer());
    if (Number(doc.file_size) !== before.byteLength || after.byteLength !== input.file_size ||
        hash(after) !== input.file_hash.toLowerCase() ||
        after.byteLength > before.byteLength * 0.96) {
      throw new Error("파일 크기·해시 또는 최소 4% 절감 조건 검증 실패");
    }
    if (!(await isStructurallyCompatible(extension, before, after))) {
      throw new Error("원본과 압축본 구조가 일치하지 않아 교체하지 않았습니다.");
    }
    await assertExclusiveSource(supabase, input.document_id, sourcePath);

    // Compare-and-set ensures concurrent edits cannot be overwritten.
    let update = supabase.from("partner_documents")
      .update({
        storage_path: input.path, file_path: input.path,
        file_size: after.byteLength, file_hash: hash(after),
        updated_at: new Date().toISOString()
      }).eq("id", input.document_id);
    if (doc.storage_path) update = update.eq("storage_path", String(doc.storage_path));
    else update = update.is("storage_path", null);
    const { data: moved, error: updateError } = await update.select("id").maybeSingle();
    if (updateError || !moved) {
      throw new Error(updateError?.message ?? "동시 변경이 발생했습니다. 기존 문서를 유지했습니다.");
    }

    // Delete only when no live OR historical DB row still uses the original path.
    const [refA, refB] = await Promise.all([
      supabase.from("partner_documents").select("id", { head: true, count: "exact" }).eq("storage_path", sourcePath),
      supabase.from("partner_documents").select("id", { head: true, count: "exact" }).eq("file_path", sourcePath)
    ]);
    let removedOriginal = false;
    if (!refA.error && !refB.error && refA.count === 0 && refB.count === 0) {
      removedOriginal = !(await bucket.remove([sourcePath])).error;
    }
    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard/partners/" + doc.partner_id);
    const budget = await readPartnerStorageBudget(supabase).catch(() => null);
    return NextResponse.json({
      ok: true, saved_bytes: before.length - after.length,
      original_bytes: before.length, optimized_bytes: after.length,
      removed_original: removedOriginal, budget
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "교체 검증 실패" }, { status: 400 });
  }
}
