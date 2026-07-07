import JSZip from "jszip";
import { POLICY_CHUNK_MAX, POLICY_CHUNK_MIN } from "@/lib/policy/constants";
import { categorizePolicySlide, extractKeywords } from "@/lib/policy/categorize";
import {
  decodeXmlEntities,
  isBadParseContent,
  isUselessPolicyLine,
  normalizePolicyParagraphs,
  sanitizePolicyText
} from "@/lib/policy/xml-text";

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

function extractATextNodes(xml: string): string[] {
  const texts: string[] = [];
  const regex = /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const raw = match[1] ?? "";
    const text = sanitizePolicyText(raw);
    if (text && !isUselessPolicyLine(text)) {
      texts.push(text);
    }
  }
  return texts;
}

function extractTablesFromSlideXml(xml: string): string[] {
  const tables: string[] = [];
  const tblRegex = /<a:tbl[\s\S]*?<\/a:tbl>/gi;
  let tblMatch: RegExpExecArray | null;

  while ((tblMatch = tblRegex.exec(xml)) !== null) {
    const rows: string[] = [];
    const trRegex = /<a:tr[\s\S]*?<\/a:tr>/gi;
    let trMatch: RegExpExecArray | null;

    while ((trMatch = trRegex.exec(tblMatch[0])) !== null) {
      const cells: string[] = [];
      const tcRegex = /<a:tc[\s\S]*?<\/a:tc>/gi;
      let tcMatch: RegExpExecArray | null;

      while ((tcMatch = tcRegex.exec(trMatch[0])) !== null) {
        const cellTexts = extractATextNodes(tcMatch[0]);
        const cell = cellTexts.join(" ").trim();
        if (cell && !isUselessPolicyLine(cell)) {
          cells.push(cell);
        }
      }

      if (cells.length > 0) {
        rows.push(cells.join("\t"));
      }
    }

    if (rows.length > 0) {
      tables.push(rows.join("\n"));
    }
  }

  return tables;
}

function extractSlidePlainTexts(xml: string): string[] {
  const withoutTables = xml.replace(/<a:tbl[\s\S]*?<\/a:tbl>/gi, "");
  return extractATextNodes(withoutTables);
}

function buildSlideBody(plainTexts: string[], tables: string[]): string {
  const parts: string[] = [];

  if (plainTexts.length > 0) {
    parts.push(normalizePolicyParagraphs(plainTexts));
  }

  for (const table of tables) {
    if (table.trim() && !isBadParseContent(table)) {
      parts.push(table.trim());
    }
  }

  return parts.filter(Boolean).join("\n\n").trim();
}

function pickSlideTitle(plainTexts: string[], body: string): string {
  if (plainTexts.length > 0) {
    const candidate = plainTexts[0]?.trim();
    if (candidate && candidate.length <= 120 && !isUselessPolicyLine(candidate)) {
      return candidate;
    }
  }

  const firstLine = body.split("\n").find((line) => line.trim() && !isUselessPolicyLine(line));
  return firstLine?.trim().slice(0, 120) ?? "";
}

function splitIntoChunks(title: string, body: string): string[] {
  const full = [title, body].filter(Boolean).join("\n\n").trim();
  if (!full || isBadParseContent(full)) return [];
  if (full.length <= POLICY_CHUNK_MAX) return [full];

  const paragraphs = full.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (isBadParseContent(paragraph)) continue;

    const candidate = current ? `${current}\n${paragraph}` : paragraph;
    if (candidate.length > POLICY_CHUNK_MAX && current.length >= POLICY_CHUNK_MIN) {
      if (!isBadParseContent(current)) chunks.push(current);
      current = paragraph;
    } else if (candidate.length > POLICY_CHUNK_MAX) {
      for (let i = 0; i < paragraph.length; i += POLICY_CHUNK_MAX) {
        const slice = paragraph.slice(i, i + POLICY_CHUNK_MAX);
        if (!isBadParseContent(slice)) chunks.push(slice);
      }
      current = "";
    } else {
      current = candidate;
    }
  }

  if (current.trim() && !isBadParseContent(current.trim())) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : isBadParseContent(full) ? [] : [full];
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
    const plainTexts = extractSlidePlainTexts(xml);
    const tables = extractTablesFromSlideXml(xml);
    const body = buildSlideBody(plainTexts, tables);
    const title = pickSlideTitle(plainTexts, body);

    if (!title && !body) continue;

    const slideNumber = index + 1;
    const category = categorizePolicySlide(title, body);
    const keywords = extractKeywords(title, body);
    const chunkTexts = splitIntoChunks(title, body).filter((content) => !isBadParseContent(content));

    if (chunkTexts.length === 0) continue;

    slides.push({
      slide_number: slideNumber,
      title: title || `슬라이드 ${slideNumber}`,
      body,
      category,
      keywords,
      chunks: chunkTexts.map((content, chunkIndex) => ({
        section_title:
          chunkTexts.length > 1
            ? `${title || `슬라이드 ${slideNumber}`} (${chunkIndex + 1})`
            : title || `슬라이드 ${slideNumber}`,
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

// Re-export for tests
export { decodeXmlEntities };
