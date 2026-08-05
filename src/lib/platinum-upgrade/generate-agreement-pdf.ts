/**
 * 플래티넘 부속합의서 PDF
 * - 생성된 DOCX의 document.xml 구조(문단·페이지나눔·표)를 기준으로 렌더링
 * - 한글 폰트는 TTF(NotoSansKR) 우선으로 subset 임베드 (Noto OTF subset은 CFF 깨짐)
 */
import fs from "fs";
import path from "path";
import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  formatContractFilenameDate,
  normalizeContractCompanyName
} from "@/lib/partner-application/contract-dates";
import type { PlatinumAgreementInput } from "@/lib/platinum-upgrade/generate-agreement";

export type PlatinumAgreementPdfResult =
  | {
      ok: true;
      filename: string;
      buffer: Buffer;
      contentType: string;
      pageCount: number;
    }
  | { ok: false; message: string };

type DocBlock =
  | { type: "paragraph"; text: string; pageBreakBefore: boolean }
  | { type: "table"; rows: string[][]; pageBreakBefore: boolean };

const FONT_CANDIDATES = [
  path.join(/*turbopackIgnore: true*/ process.cwd(), "assets", "fonts", "NotoSansKR-Regular.ttf"),
  path.join(/*turbopackIgnore: true*/ process.cwd(), "assets", "fonts", "malgun.ttf"),
  "C:\\Windows\\Fonts\\malgun.ttf",
  path.join(/*turbopackIgnore: true*/ process.cwd(), "assets", "fonts", "NotoSansKR-Regular.otf")
];

function resolveKoreanFontPath(): string | null {
  for (const candidate of FONT_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractParagraphText(paragraphXml: string): string {
  const parts: string[] = [];
  const re = /<w:t\b[^>]*>([^<]*)<\/w:t>|<w:tab\/>|<w:br\b[^/]*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(paragraphXml))) {
    if (match[0].startsWith("<w:t")) {
      parts.push(unescapeXml(match[1] ?? ""));
    } else if (match[0].startsWith("<w:tab")) {
      parts.push("\t");
    } else if (!/w:type="page"/.test(match[0])) {
      parts.push("\n");
    }
  }
  return parts.join("").replace(/\u00a0/g, " ").trimEnd();
}

function extractTableRows(tableXml: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(tableXml))) {
    const cells: string[] = [];
    const cellRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[0]))) {
      const cellParas = [...cellMatch[0].matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((p) =>
        extractParagraphText(p[0]).trim()
      );
      cells.push(cellParas.filter(Boolean).join("\n"));
    }
    rows.push(cells);
  }
  return rows;
}

export async function extractDocxBlocks(docxBuffer: Buffer): Promise<DocBlock[]> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("DOCX document.xml을 읽을 수 없습니다.");

  const body = documentXml.match(/<w:body\b[\s\S]*<\/w:body>/)?.[0];
  if (!body) throw new Error("DOCX body를 읽을 수 없습니다.");

  const blocks: DocBlock[] = [];
  const re = /<(w:p|w:tbl)\b[\s\S]*?<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    const tag = match[1];
    const chunk = match[0];
    const pageBreakBefore = /w:type="page"/.test(chunk);
    if (tag === "w:p") {
      const text = extractParagraphText(chunk);
      if (!text.trim() && !pageBreakBefore) continue;
      blocks.push({ type: "paragraph", text, pageBreakBefore });
    } else {
      blocks.push({
        type: "table",
        rows: extractTableRows(chunk),
        pageBreakBefore
      });
    }
  }
  return blocks;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n/);
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const ch of [...paragraph]) {
      const next = current + ch;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = ch;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function isHeading(text: string): boolean {
  return (
    /^\[부속서류\]/.test(text) ||
    /^오케스트로 플래티넘/.test(text) ||
    /^제\s*[0-9０-９]+조/.test(text) ||
    /^\[붙임/.test(text)
  );
}

function drawTable(
  page: PDFPage,
  rows: string[][],
  opts: {
    font: PDFFont;
    fontSize: number;
    x: number;
    y: number;
    maxWidth: number;
    bottom: number;
    onNewPage: () => PDFPage;
  }
): { page: PDFPage; y: number } {
  let current = page;
  let y = opts.y;
  const colCount = Math.max(1, ...rows.map((r) => r.length));
  const colWidth = opts.maxWidth / colCount;
  const padding = 2;
  const lineHeight = opts.fontSize + 2;

  for (const row of rows) {
    const cellLines = row.map((cell) =>
      wrapText(cell || " ", opts.font, opts.fontSize, Math.max(20, colWidth - padding * 2))
    );
    while (cellLines.length < colCount) cellLines.push([" "]);
    const rowLines = Math.max(1, ...cellLines.map((lines) => lines.length));
    const rowHeight = rowLines * lineHeight + padding * 2;

    if (y - rowHeight < opts.bottom) {
      current = opts.onNewPage();
      y = opts.y;
    }

    const top = y;
    current.drawRectangle({
      x: opts.x,
      y: top - rowHeight,
      width: opts.maxWidth,
      height: rowHeight,
      borderColor: rgb(0.45, 0.45, 0.5),
      borderWidth: 0.6
    });

    for (let c = 0; c < colCount; c++) {
      const cx = opts.x + c * colWidth;
      if (c > 0) {
        current.drawLine({
          start: { x: cx, y: top },
          end: { x: cx, y: top - rowHeight },
          thickness: 0.5,
          color: rgb(0.55, 0.55, 0.58)
        });
      }
      let ty = top - padding - opts.fontSize;
      for (const line of cellLines[c] ?? []) {
        if (line.trim()) {
          current.drawText(line, {
            x: cx + padding,
            y: ty,
            size: opts.fontSize,
            font: opts.font,
            color: rgb(0.1, 0.1, 0.12)
          });
        }
        ty -= lineHeight;
      }
    }

    y -= rowHeight;
  }

  return { page: current, y: y - 6 };
}

function validateKoreanFont(font: PDFFont): string | null {
  const sample = "한글테스트주식회사앤티에스";
  try {
    const width = font.widthOfTextAtSize(sample, 10);
    if (!(width > 40)) {
      return "한글 폰트 메트릭이 비정상입니다. 폰트 임베드를 확인해 주세요.";
    }
  } catch {
    return "한글 폰트로 텍스트를 측정할 수 없습니다.";
  }
  return null;
}

export async function generatePlatinumAgreementPdfFromDocx(
  input: PlatinumAgreementInput,
  docxBuffer: Buffer
): Promise<PlatinumAgreementPdfResult> {
  const company = normalizeContractCompanyName(input.companyName);
  if (!company) return { ok: false, message: "상호(회사명)가 필요합니다." };

  const fontPath = resolveKoreanFontPath();
  if (!fontPath) {
    return {
      ok: false,
      message:
        "한글 PDF 폰트를 찾을 수 없습니다. assets/fonts/NotoSansKR-Regular.otf 를 추가해 주세요."
    };
  }

  let blocks: DocBlock[];
  try {
    blocks = await extractDocxBlocks(docxBuffer);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "DOCX 구조를 읽지 못했습니다."
    };
  }

  if (blocks.length === 0) {
    return { ok: false, message: "DOCX에서 렌더링할 문단을 찾지 못했습니다." };
  }

  const allText = blocks
    .map((b) => (b.type === "paragraph" ? b.text : b.rows.flat().join(" ")))
    .join("\n");
  if (!allText.includes(company)) {
    return {
      ok: false,
      message: "생성된 DOCX 본문에 상호가 없어 PDF를 만들 수 없습니다."
    };
  }

  const fontBytes = fs.readFileSync(fontPath);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // CJK: TTF(맑은 고딕) subset이 가장 안정적. Noto OTF는 전체 임베드 시 PUA 고갈이 있어
  // 문서에 실제 쓰인 글리프만 subset으로 임베드한다(짧은 샘플에서는 정상 추출 확인).
  let font: PDFFont;
  try {
    font = await pdfDoc.embedFont(fontBytes, { subset: true });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `한글 폰트 임베드 실패: ${error.message}`
          : "한글 폰트 임베드에 실패했습니다."
    };
  }

  const fontError = validateKoreanFont(font);
  if (fontError) return { ok: false, message: fontError };

  const margin = 36;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const contentWidth = pageWidth - margin * 2;
  const bodySize = 8.2;
  const headingSize = 9.5;
  const titleSize = 11;
  const lineHeight = 11.2;
  const topY = pageHeight - margin;
  const bottom = 32;

  const makePage = () => pdfDoc.addPage([pageWidth, pageHeight]);
  let page = makePage();
  let y = topY;
  let companyDrawn = false;

  const ensureSpace = (needed: number) => {
    if (y - needed < bottom) {
      page = makePage();
      y = topY;
    }
  };

  for (const block of blocks) {
    if (block.pageBreakBefore) {
      page = makePage();
      y = topY;
    }

    if (block.type === "paragraph") {
      const text = block.text.trim();
      if (!text) {
        y -= lineHeight * 0.6;
        continue;
      }

      const fontSize = /^\[부속서류\]/.test(text)
        ? headingSize
        : /^오케스트로 플래티넘/.test(text)
          ? titleSize
          : isHeading(text)
            ? headingSize
            : bodySize;
      const lh = fontSize + 4;
      const lines = wrapText(text, font, fontSize, contentWidth);

      for (const line of lines) {
        ensureSpace(lh);
        if (line) {
          page.drawText(line, {
            x: margin,
            y,
            size: fontSize,
            font,
            color: rgb(0.08, 0.08, 0.1)
          });
          if (line.includes(company)) companyDrawn = true;
        }
        y -= lh;
      }
      y -= 1.5;
      continue;
    }

    // table
    ensureSpace(36);
    const drawn = drawTable(page, block.rows, {
      font,
      fontSize: 7,
      x: margin,
      y,
      maxWidth: contentWidth,
      bottom,
      onNewPage: () => {
        page = makePage();
        y = topY;
        return page;
      }
    });
    page = drawn.page;
    y = drawn.y;
    if (block.rows.flat().some((cell) => cell.includes(company))) {
      companyDrawn = true;
    }
  }

  if (!companyDrawn) {
    return {
      ok: false,
      message: "PDF에 상호를 그리지 못했습니다. 다운로드를 제공하지 않습니다."
    };
  }

  const pageCount = pdfDoc.getPageCount();
  if (pageCount < 1) {
    return { ok: false, message: "PDF 페이지가 비어 있습니다." };
  }

  const pdfBytes = await pdfDoc.save();
  // subset TTF는 수십~수백 KB, 전체 임베드는 수 MB. 크기만으로 실패 처리하지 않음.
  if (pdfBytes.byteLength < 5_000) {
    return {
      ok: false,
      message: "생성된 PDF가 비정상적으로 작습니다. 한글 폰트 임베드를 확인해 주세요."
    };
  }

  const safeCompany = company.replace(/[\\/:*?"<>|]/g, "_").trim() || "partner";
  const filename = `플래티넘_부속합의서_${safeCompany}_${formatContractFilenameDate(input.agreementDate)}.pdf`;

  return {
    ok: true,
    filename,
    buffer: Buffer.from(pdfBytes),
    contentType: "application/pdf",
    pageCount
  };
}

/** @deprecated 텍스트 재구성 방식 — DOCX 기반 생성으로 대체 */
export async function generatePlatinumAgreementPdf(
  input: PlatinumAgreementInput,
  docxBuffer?: Buffer
): Promise<PlatinumAgreementPdfResult> {
  if (!docxBuffer?.length) {
    return {
      ok: false,
      message: "PDF 생성을 위해 생성된 DOCX 버퍼가 필요합니다."
    };
  }
  return generatePlatinumAgreementPdfFromDocx(input, docxBuffer);
}
