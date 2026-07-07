import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { PARTNER_POLICY_BUCKET } from "@/lib/policy/constants";
import { getPolicyFileType, parsePptxBuffer } from "@/lib/policy/parse-pptx";
import { validatePolicyParse } from "@/lib/policy/validate-parse";
import { isBadParseContent } from "@/lib/policy/xml-text";
import {
  buildPolicyStoragePath,
  ensurePartnerPolicyBucket,
  isSafePolicyStorageKey
} from "@/lib/policy/storage";

const SaveSchema = z.object({
  policy_title: z.string().min(1),
  version_label: z.string().min(1),
  effective_date: z.string().min(1),
  description: z.string().nullable().optional(),
  change_memo: z.string().nullable().optional(),
  apply_as_current: z.boolean().default(true),
  uploaded_by: z.string().nullable().optional(),
  slide_details: z
    .array(
      z.object({
        slide_number: z.number(),
        title: z.string(),
        body: z.string(),
        category: z.string(),
        keywords: z.array(z.string()),
        chunks: z.array(
          z.object({
            section_title: z.string(),
            content: z.string(),
            keywords: z.array(z.string())
          })
        )
      })
    )
    .optional()
});

export async function POST(request: Request) {
  const supabase = createAdminClient();

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const metadataRaw = formData.get("metadata");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "파일이 없습니다." }, { status: 400 });
    }
    if (!metadataRaw) {
      return NextResponse.json({ ok: false, message: "metadata가 없습니다." }, { status: 400 });
    }

    const metadata = SaveSchema.parse(JSON.parse(String(metadataRaw)));
    const fileType = getPolicyFileType(file.name);
    const documentId = crypto.randomUUID();
    const storagePath = buildPolicyStoragePath(metadata.effective_date, documentId, file.name);

    if (!isSafePolicyStorageKey(storagePath)) {
      return NextResponse.json({ ok: false, message: "저장 경로가 유효하지 않습니다." }, { status: 400 });
    }

    await ensurePartnerPolicyBucket(supabase);

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(PARTNER_POLICY_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (uploadError) {
      throw new Error(`파일 업로드 실패: ${uploadError.message}`);
    }

    if (metadata.apply_as_current) {
      const { error: unsetError } = await supabase
        .from("partner_policy_documents")
        .update({ is_current: false, updated_at: new Date().toISOString() })
        .eq("is_current", true);
      if (unsetError) throw new Error(unsetError.message);
    }

    const { data: document, error: docError } = await supabase
      .from("partner_policy_documents")
      .insert({
        id: documentId,
        policy_title: metadata.policy_title,
        version_label: metadata.version_label,
        effective_date: metadata.effective_date,
        source_file_name: file.name,
        storage_path: storagePath,
        file_type: fileType,
        file_size: file.size,
        description: metadata.description ?? null,
        change_memo: metadata.change_memo ?? null,
        is_current: metadata.apply_as_current,
        status: "active",
        uploaded_by: metadata.uploaded_by ?? null
      })
      .select("id")
      .single();

    if (docError || !document) {
      throw new Error(docError?.message ?? "정책 문서 저장 실패");
    }

    let slideDetails = metadata.slide_details ?? [];
    if (fileType === "pptx" || fileType === "ppt") {
      const parsed = await parsePptxBuffer(fileBuffer);
      const validation = validatePolicyParse(parsed.slides);
      if (!validation.can_save) {
        throw new Error(validation.block_reason ?? "PPTX 텍스트 추출 결과가 비정상입니다.");
      }
      slideDetails = parsed.slides;
    }

    const chunkRows = slideDetails.flatMap((slide) =>
      slide.chunks
        .filter((chunk) => !isBadParseContent(chunk.content))
        .map((chunk) => ({
          policy_document_id: documentId,
          section_title: chunk.section_title,
          category: slide.category,
          slide_number: slide.slide_number,
          page_number: null,
          content: chunk.content,
          keywords: chunk.keywords,
          is_active: true,
          parse_status: "active",
          raw_json: {
            slide_title: slide.title,
            slide_body: slide.body
          }
        }))
    );

    if (chunkRows.length > 0) {
      const { error: chunkError } = await supabase.from("partner_policy_chunks").insert(chunkRows);
      if (chunkError) throw new Error(chunkError.message);
    }

    revalidatePath("/dashboard/policy");
    revalidatePath("/dashboard/policy/upload");
    revalidatePath("/dashboard/chat");

    return NextResponse.json({
      ok: true,
      document_id: documentId,
      storage_path: storagePath,
      chunk_count: chunkRows.length,
      is_current: metadata.apply_as_current
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "저장 실패" },
      { status: 400 }
    );
  }
}
