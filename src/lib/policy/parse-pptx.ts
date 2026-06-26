import JSZip from "jszip";
import { POLICY_CHUNK_MAX, POLICY_CHUNK_MIN } from "@/lib/policy/constants";
import { categorizePolicySlide, extractKeywords } from "@/lib/policy/categorize";

export type ParsedPolicySlide = {
  slide_number: number;
  title: string;
  body: string;
  category: string;
  keywords: string[];
  chunks: Array<{
    section_title: string;
    content: string;
    keywords: string[];
  }>;
};

export type PptxParseResult = {
  slides: ParsedPolicySlide[];
  total_slides: number;
  total_chunks: number;
};

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTextsFromSlideXml(xml: string): string[] {
  const texts: string[] = [];
  const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const text = decodeXmlEntities(match[1] ?? "").trim();
    if (text) texts.push(text);
  }
  return texts;
}

function splitSlideText(texts: string[]): { title: string; body: string } {
  if (texts.length === 0) return { title: "", body: "" };
  const title = texts[0] ?? "";
  const body = texts.slice(1).join("\n").trim();
  return { title, body: body || title };
}

function splitIntoChunks(title: string, body: string): string[] {
  const full = [title, body].filter(Boolean).join("\n\n").trim();
  if (!full) return [];
  if (full.length <= POLICY_CHUNK_MAX) return [full];

  const paragraphs = full.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length > POLICY_CHUNK_MAX && current.length >= POLICY_CHUNK_MIN) {
      chunks.push(current);
      current = paragraph;
    } else if (candidate.length > POLICY_CHUNK_MAX) {
      for (let i = 0; i < paragraph.length; i += POLICY_CHUNK_MAX) {
        chunks.push(paragraph.slice(i, i + POLICY_CHUNK_MAX));
      }
      current = "";
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [full];
}

export async function parsePptxBuffer(buffer: ArrayBuffer): Promise<PptxParseResult> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)/i)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)/i)?.[1] ?? 0);
      return na - nb;
    });

  const slides: ParsedPolicySlide[] = [];

  for (let index = 0; index < slidePaths.length; index += 1) {
    const path = slidePaths[index]!;
    const xml = await zip.file(path)!.async("string");
    const texts = extractTextsFromSlideXml(xml);
    const { title, body } = splitSlideText(texts);
    if (!title && !body) continue;

    const slideNumber = index + 1;
    const category = categorizePolicySlide(title, body);
    const keywords = extractKeywords(title, body);
    const chunkTexts = splitIntoChunks(title, body);

    slides.push({
      slide_number: slideNumber,
      title: title || `슬라이드 ${slideNumber}`,
      body,
      category,
      keywords,
      chunks: chunkTexts.map((content, chunkIndex) => ({
        section_title:
          chunkTexts.length > 1 ? `${title || `슬라이드 ${slideNumber}`} (${chunkIndex + 1})` : title || `슬라이드 ${slideNumber}`,
        content,
        keywords: extractKeywords(title, content)
      }))
    });
  }

  const total_chunks = slides.reduce((sum, slide) => sum + slide.chunks.length, 0);
  return { slides, total_slides: slides.length, total_chunks };
}

export function getPolicyFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return ext || "unknown";
}
