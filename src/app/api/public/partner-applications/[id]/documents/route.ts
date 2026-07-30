import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySecret } from "@/lib/partner-applications/tokens";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/partner-applications/rate-limit";
import {
  PARTNER_APPLICATIONS_BUCKET,
  logApplicationEvent
} from "@/lib/partner-applications/repository";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf", "xlsx", "docx", "png", "jpg", "jpeg"]);
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "application/octet-stream"
]);

const DOC_TYPES = new Set([
  "business_registration",
  "company_intro",
  "financial",
  "other"
]);

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  const ip = clientIpFromHeaders(request.headers);
  const limited = checkRateLimit(`pa-doc:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다." }, { status: 429 });
  }

  const form = await request.formData();
  const token = String(form.get("token") || "");
  const documentType = String(form.get("document_type") || "other");
  const honeypot = String(form.get("honeypot") || "");
  const file = form.get("file");

  if (honeypot) return NextResponse.json({ ok: true });
  if (!token) {
    return NextResponse.json({ ok: false, message: "token이 필요합니다." }, { status: 400 });
  }
  if (!DOC_TYPES.has(documentType)) {
    return NextResponse.json({ ok: false, message: "문서 유형이 올바르지 않습니다." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, message: "파일이 필요합니다." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "파일은 10MB 이하여야 합니다." }, { status: 400 });
  }

  const fileName = file.name || "upload.bin";
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { ok: false, message: "허용 확장자: PDF, XLSX, DOCX, PNG, JPG" },
      { status: 400 }
    );
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ ok: false, message: "허용되지 않는 파일 형식입니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("id, status, access_token_hash")
    .eq("id", id)
    .maybeSingle();
  if (error || !app) {
    return NextResponse.json({ ok: false, message: "신청서를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!verifySecret(token, String(app.access_token_hash))) {
    return NextResponse.json({ ok: false, message: "수정 권한이 없습니다." }, { status: 403 });
  }
  if (!["draft", "revision_requested"].includes(String(app.status))) {
    return NextResponse.json(
      { ok: false, message: "현재 상태에서는 파일을 업로드할 수 없습니다." },
      { status: 409 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const fileHash = createHash("sha256").update(buf).digest("hex");

  // Duplicate same hash for same type → reuse active
  const { data: sameHash } = await supabase
    .from("partner_application_documents")
    .select("id")
    .eq("application_id", id)
    .eq("document_type", documentType)
    .eq("file_hash", fileHash)
    .eq("is_active", true)
    .maybeSingle();
  if (sameHash) {
    return NextResponse.json({ ok: true, document_id: sameHash.id, reused: true });
  }

  // Deactivate + remove previous active files of same type
  const { data: previous } = await supabase
    .from("partner_application_documents")
    .select("id, storage_path")
    .eq("application_id", id)
    .eq("document_type", documentType)
    .eq("is_active", true);

  const safeName = fileName.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
  const storagePath = `${id}/${documentType}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(PARTNER_APPLICATIONS_BUCKET)
    .upload(storagePath, buf, {
      upsert: false,
      contentType: file.type || "application/octet-stream"
    });
  if (upErr) {
    return NextResponse.json({ ok: false, message: upErr.message }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await supabase
    .from("partner_application_documents")
    .insert({
      application_id: id,
      document_type: documentType,
      file_name: fileName,
      storage_path: storagePath,
      file_ext: ext,
      file_size: buf.byteLength,
      file_hash: fileHash,
      mime_type: file.type || null,
      is_active: true
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    await supabase.storage.from(PARTNER_APPLICATIONS_BUCKET).remove([storagePath]);
    return NextResponse.json(
      { ok: false, message: insErr?.message ?? "문서 저장 실패" },
      { status: 500 }
    );
  }

  if (previous?.length) {
    const paths = previous.map((p) => String(p.storage_path));
    await supabase
      .from("partner_application_documents")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in(
        "id",
        previous.map((p) => p.id)
      );
    if (paths.length) {
      await supabase.storage.from(PARTNER_APPLICATIONS_BUCKET).remove(paths);
    }
  }

  await logApplicationEvent(supabase, id, "document_uploaded", documentType, {
    document_id: inserted.id
  });

  return NextResponse.json({ ok: true, document_id: inserted.id, reused: false });
}
