import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import {
  computeFileHash,
  deletePartnerDocumentHard,
  pickDocumentStoragePath,
  purgeSupersededDocumentsForType,
  removeDocumentStorage,
  usesCanonicalTypeStorage
} from "@/lib/documents/document-lifecycle";
import {
  isSafeStorageObjectKey,
  resolveCanonicalUploadStoragePath,
  resolveUploadStoragePath
} from "@/lib/documents/storage-path";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "교체할 파일이 없습니다." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: existing, error: fetchError } = await supabase
      .from("partner_documents")
      .select(
        "id, partner_id, document_type, original_filename, storage_path, file_path, file_hash, file_ext"
      )
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchError || !existing) {
      return NextResponse.json(
        { ok: false, message: fetchError?.message ?? "문서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = computeFileHash(buffer);
    if (existing.file_hash === fileHash) {
      return NextResponse.json({ ok: true, skipped: true, message: "동일한 파일입니다." });
    }

    const fileExt =
      file.name.split(".").pop()?.toLowerCase() ||
      existing.file_ext ||
      "bin";
    const originalFilename = file.name;
    const useCanonical = usesCanonicalTypeStorage(existing.document_type, originalFilename);
    const previousPath = pickDocumentStoragePath(existing);

    const storagePath = useCanonical
      ? resolveCanonicalUploadStoragePath(
          existing.partner_id,
          existing.document_type ?? "other",
          fileExt,
          originalFilename,
          existing.storage_path,
          existing.file_path,
          true
        )
      : resolveUploadStoragePath(
          existing.partner_id,
          existing.document_type ?? "other",
          fileExt,
          originalFilename,
          existing.storage_path,
          existing.file_path
        );

    if (!isSafeStorageObjectKey(storagePath)) {
      return NextResponse.json({ ok: false, message: "안전한 Storage 경로를 생성하지 못했습니다." }, { status: 400 });
    }

    const { error: uploadError } = await supabase.storage
      .from(PARTNER_DOCUMENTS_BUCKET)
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: file.type || "application/octet-stream"
      });

    if (uploadError) {
      return NextResponse.json({ ok: false, message: uploadError.message }, { status: 400 });
    }

    const displayName = originalFilename;
    const { error: updateError } = await supabase
      .from("partner_documents")
      .update({
        original_filename: originalFilename,
        display_name: displayName,
        file_name: displayName,
        file_path: storagePath,
        storage_path: storagePath,
        file_ext: fileExt,
        file_size: buffer.byteLength,
        file_hash: fileHash,
        is_active: true,
        is_duplicate: false,
        duplicate_of: null,
        deleted_at: null,
        document_status: "active",
        uploaded_by: auth.userId
      })
      .eq("id", id);

    if (updateError) {
      console.error("[document-replace] DB update failed", { documentId: id, storagePath, error: updateError.message });
      return NextResponse.json({ ok: false, message: updateError.message }, { status: 400 });
    }

    if (previousPath && previousPath !== storagePath) {
      const removed = await removeDocumentStorage(supabase, previousPath);
      if (!removed.ok) {
        console.error("[document-replace] old storage delete failed", {
          documentId: id,
          path: previousPath,
          error: removed.error
        });
      }
    }

    if (useCanonical && existing.document_type) {
      const purged = await purgeSupersededDocumentsForType(
        supabase,
        existing.partner_id,
        existing.document_type,
        id
      );
      if (purged.errors.length > 0) {
        console.error("[document-replace] purge superseded", {
          documentId: id,
          removedIds: purged.removedIds,
          deletedStorage: purged.deletedStorage,
          errors: purged.errors
        });
      }
    }

    revalidatePath("/dashboard/documents");
    revalidatePath(`/dashboard/partners/${existing.partner_id}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "문서 교체 실패"
      },
      { status: 400 }
    );
  }
}
