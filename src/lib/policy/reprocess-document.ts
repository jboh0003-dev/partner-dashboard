import type { SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_POLICY_BUCKET } from "@/lib/policy/constants";
import { getPolicyFileType, parsePptxBuffer } from "@/lib/policy/parse-pptx";
import { validatePolicyParse } from "@/lib/policy/validate-parse";
import { isBadParseContent } from "@/lib/policy/xml-text";

export type ReprocessPolicyResult = {
  document_id: string;
  deactivated_chunks: number;
  inserted_chunks: number;
  validation: ReturnType<typeof validatePolicyParse>;
};

export async function reprocessPolicyDocumentChunks(
  supabase: SupabaseClient,
  documentId: string
): Promise<ReprocessPolicyResult> {
  const { data: document, error: docError } = await supabase
    .from("partner_policy_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (docError || !document) {
    throw new Error(docError?.message ?? "정책 문서를 찾을 수 없습니다.");
  }

  const fileType = getPolicyFileType(String(document.source_file_name));
  if (fileType !== "pptx" && fileType !== "ppt") {
    throw new Error("PPTX 파일만 재처리할 수 있습니다.");
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(PARTNER_POLICY_BUCKET)
    .download(String(document.storage_path));

  if (downloadError || !blob) {
    throw new Error(downloadError?.message ?? "원본 파일 다운로드 실패");
  }

  const buffer = await blob.arrayBuffer();
  const parsed = await parsePptxBuffer(buffer);
  const validation = validatePolicyParse(parsed.slides);

  if (!validation.can_save) {
    throw new Error(validation.block_reason ?? "PPTX 재처리 결과가 비정상입니다.");
  }

  const { data: existingChunks } = await supabase
    .from("partner_policy_chunks")
    .select("id")
    .eq("policy_document_id", documentId);

  const existingIds = (existingChunks ?? []).map((row) => String(row.id));

  if (existingIds.length > 0) {
    const { error: deactivateError } = await supabase
      .from("partner_policy_chunks")
      .update({ is_active: false, parse_status: "bad_parse" })
      .eq("policy_document_id", documentId);

    if (deactivateError) {
      const { error: deleteError } = await supabase
        .from("partner_policy_chunks")
        .delete()
        .eq("policy_document_id", documentId);
      if (deleteError) throw new Error(deleteError.message);
    }
  }

  const chunkRows = parsed.slides.flatMap((slide) =>
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

  if (chunkRows.length === 0) {
    throw new Error("재처리 후 저장 가능한 텍스트 chunk가 없습니다.");
  }

  let { error: insertError } = await supabase.from("partner_policy_chunks").insert(chunkRows);
  if (insertError && /is_active|parse_status/.test(insertError.message)) {
    const fallbackRows = chunkRows.map((row) => {
      const { is_active: _a, parse_status: _p, ...rest } = row;
      return rest;
    });
    ({ error: insertError } = await supabase.from("partner_policy_chunks").insert(fallbackRows));
  }
  if (insertError) throw new Error(insertError.message);

  await supabase
    .from("partner_policy_documents")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", documentId);

  return {
    document_id: documentId,
    deactivated_chunks: existingIds.length,
    inserted_chunks: chunkRows.length,
    validation
  };
}
