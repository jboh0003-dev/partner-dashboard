import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { computeFileHash } from "@/lib/documents/document-lifecycle";
import { isSafeStorageObjectKey, resolveUploadStoragePath } from "@/lib/documents/storage-path";
import { optimizePartnerUploadFile } from "@/lib/documents/optimize-upload-file";
import { requirePartnerStorageBudget } from "@/lib/storage/upload-budget";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectUnlessAdmin } from "@/lib/auth/require-admin";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await rejectUnlessAdmin();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const input = formData.get("file");
    if (!(input instanceof File)) {
      return NextResponse.json({ ok: false, message: "교체할 파일이 없습니다." }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("partner_documents")
      .select("id,partner_id,document_type,original_filename,storage_path,file_path,file_hash,file_size,file_ext")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (fetchError || !existing) {
      return NextResponse.json(
        { ok: false, message: fetchError?.message ?? "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const optimized = await optimizePartnerUploadFile(input);
    const storedFile = optimized.file;
    const buffer = Buffer.from(await storedFile.arrayBuffer());
    const fileHash = computeFileHash(buffer);
    if (existing.file_hash === fileHash) {
      return NextResponse.json({ ok: true, skipped: true, message: "동일한 문서입니다." });
    }
    await requirePartnerStorageBudget(supabase, buffer.length);
    const type = existing.document_type ?? "other";
    const ext = input.name.split(".").pop()?.toLowerCase() ?? existing.file_ext ?? "bin";
    const originalPath = existing.storage_path ?? existing.file_path;
    const path = resolveUploadStoragePath(
      existing.partner_id, type, ext, input.name + "#" + fileHash
    );
    if (!isSafeStorageObjectKey(path) || path === originalPath) {
      throw new Error("기존 파일과 구분되는 안전한 Storage 경로를 생성하지 못했습니다.");
    }
    const bucket = supabase.storage.from(PARTNER_DOCUMENTS_BUCKET);
    const { error: uploadError } = await bucket.upload(path, buffer, {
      upsert: false,
      contentType: storedFile.type || input.type || "application/octet-stream"
    });
    if (uploadError) throw new Error(uploadError.message);

    // The old document remains untouched until full download integrity is proved.
    const { data: resultBlob, error: downloadError } = await bucket.download(path);
    if (downloadError || !resultBlob) {
      throw new Error("교체 파일을 재다운로드하지 못했습니다. 기존 문서는 유지했습니다.");
    }
    const observed = Buffer.from(await resultBlob.arrayBuffer());
    const observedHash = createHash("sha256").update(observed).digest("hex");
    if (observed.length !== buffer.length || observedHash !== fileHash) {
      throw new Error("업로드 무결성 검증에 실패했습니다. 기존 문서는 유지했습니다.");
    }

    let update = supabase.from("partner_documents")
      .update({
        original_filename: input.name,
        display_name: input.name,
        file_name: input.name,
        file_path: path,
        storage_path: path,
        file_ext: ext,
        file_size: buffer.length,
        file_hash: fileHash,
        is_active: true,
        deleted_at: null,
        updated_at: new Date().toISOString()
      }).eq("id", id);
    if (existing.storage_path) update = update.eq("storage_path", existing.storage_path);
    else update = update.is("storage_path", null);
    const { data: updated, error: updateError } = await update.select("id").maybeSingle();
    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "문서가 다른 작업에 의해 수정되었습니다. 기존 파일은 유지했습니다.");
    }

    // A historical DB row can still reference the previous object.
    // Keep it if ANY other record refers to the same path.
    let oldDeleted = false;
    if (originalPath) {
      const [refsA, refsB] = await Promise.all([
        supabase.from("partner_documents").select("id", { count: "exact", head: true }).eq("storage_path", originalPath),
        supabase.from("partner_documents").select("id", { count: "exact", head: true }).eq("file_path", originalPath)
      ]);
      if (!refsA.error && !refsB.error && (refsA.count ?? 0) === 0 && (refsB.count ?? 0) === 0) {
        const { error: oldError } = await bucket.remove([originalPath]);
        oldDeleted = !oldError;
      }
    }

    revalidatePath("/dashboard/documents");
    revalidatePath("/dashboard/partners");
    revalidatePath("/dashboard/partners/" + existing.partner_id);
    return NextResponse.json({
      ok: true,
      optimized: optimized.savedBytes > 0,
      saved_bytes: optimized.savedBytes,
      old_file_deleted: oldDeleted,
      original_size: input.size,
      stored_size: buffer.length
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "문서 교체 실패" },
      { status: 400 }
    );
  }
}
