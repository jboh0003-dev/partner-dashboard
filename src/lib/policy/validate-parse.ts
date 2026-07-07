import type { ParsedPolicySlide } from "@/lib/policy/parse-pptx";
import { isBadParseContent } from "@/lib/policy/xml-text";

export type PolicyParseValidation = {
  total_slides: number;
  text_extracted_slides: number;
  total_chunks: number;
  xml_tag_chunks: number;
  categorized_slides: number;
  can_save: boolean;
  block_reason: string | null;
};

const BLOCK_MESSAGE =
  "PPTX 텍스트 추출 결과가 비정상입니다. XML 태그가 포함되어 있어 정책 지식으로 저장할 수 없습니다.";

export function validatePolicyParse(slides: ParsedPolicySlide[]): PolicyParseValidation {
  const total_slides = slides.length;
  const text_extracted_slides = slides.filter(
    (slide) => slide.body.trim().length > 0 || slide.chunks.some((c) => c.content.trim().length > 0)
  ).length;

  const allChunks = slides.flatMap((slide) => slide.chunks);
  const total_chunks = allChunks.length;
  const xml_tag_chunks = allChunks.filter((chunk) => isBadParseContent(chunk.content)).length;
  const categorized_slides = slides.filter((slide) => slide.category !== "기타").length;

  const xmlRatio = total_chunks > 0 ? xml_tag_chunks / total_chunks : 1;
  let can_save = true;
  let block_reason: string | null = null;

  if (text_extracted_slides === 0) {
    can_save = false;
    block_reason = BLOCK_MESSAGE;
  } else if (xmlRatio >= 0.1) {
    can_save = false;
    block_reason = BLOCK_MESSAGE;
  } else if (xml_tag_chunks > 0) {
    // 개별 bad chunk는 파서 단계에서 제외되므로 여기 도달하면 경고 수준
    can_save = true;
  }

  return {
    total_slides,
    text_extracted_slides,
    total_chunks,
    xml_tag_chunks,
    categorized_slides,
    can_save,
    block_reason
  };
}
