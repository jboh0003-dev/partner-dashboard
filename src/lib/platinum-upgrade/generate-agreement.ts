/**
 * 플래티넘 파트너 부속합의서 DOCX 생성
 * 템플릿: templates/partner-contracts/platinum-agreement-v1.1.docx
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import {
  formatBusinessNumberDisplay,
  formatContractFilenameDate,
  formatContractKoreanDate,
  normalizeContractCompanyName
} from "@/lib/partner-application/contract-dates";
import { extractPlainText } from "@/lib/partner-application/generate-contract";

export type PlatinumAgreementInput = {
  companyName: string;
  ceoName: string;
  businessNumber: string;
  /** YYYY-MM-DD — 문서 마지막 계약일 */
  agreementDate: string;
};

export type PlatinumAgreementDocxResult =
  | {
      ok: true;
      filename: string;
      buffer: Buffer;
      contentType: string;
      plainText: string;
    }
  | { ok: false; message: string; remainingPlaceholders?: string[] };

type AgreementValues = {
  company: string;
  ceo: string;
  biz: string;
  dateKo: string;
};

type TextRun = {
  absStart: number;
  absEnd: number;
  openTag: string;
  rPr: string | null;
  text: string;
};

type PlannedReplacement = {
  start: number;
  end: number;
  text: string;
};

const TEMPLATE_FILE = "platinum-agreement-v1.1.docx";
const SAMPLE_DATE = "2026년 01월 20일";

function unescapeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isRelevantXmlPath(name: string): boolean {
  if (!name.startsWith("word/") || !name.endsWith(".xml")) return false;
  if (name.includes("/theme/") || name.includes("/_rels/")) return false;
  if (
    name.endsWith("styles.xml") ||
    name.endsWith("fontTable.xml") ||
    name.endsWith("settings.xml") ||
    name.endsWith("webSettings.xml") ||
    name.endsWith("numbering.xml")
  ) {
    return false;
  }
  return (
    name === "word/document.xml" ||
    /word\/header\d*\.xml$/.test(name) ||
    /word\/footer\d*\.xml$/.test(name) ||
    name.endsWith("footnotes.xml") ||
    name.endsWith("endnotes.xml")
  );
}

function extractTextRuns(paragraph: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /<w:r\b[\s\S]*?<\/w:r>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(paragraph))) {
    const xml = match[0];
    let text = "";
    xml.replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, (_m, inner) => {
      text += unescapeXml(String(inner));
      return _m;
    });
    if (!text && /<w:tab\s*\/>/.test(xml)) text = "\t";

    const openTag = xml.match(/^<w:r\b[^>]*>/)?.[0] ?? "<w:r>";
    const rPr = xml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? null;
    runs.push({
      absStart: match.index,
      absEnd: match.index + xml.length,
      openTag,
      rPr,
      text
    });
  }
  return runs;
}

function makeTextRun(openTag: string, rPr: string | null, text: string): string {
  const space = /^\s|\s$/.test(text) || text.includes("  ") ? ` xml:space="preserve"` : "";
  return `${openTag}${rPr ?? ""}<w:t${space}>${escapeXml(text)}</w:t></w:r>`;
}

function paragraphPlainText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

function findAllOccurrences(haystack: string, needle: string): Array<{ start: number; end: number }> {
  if (!needle) return [];
  const out: Array<{ start: number; end: number }> = [];
  let pos = 0;
  while (pos <= haystack.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx < 0) break;
    out.push({ start: idx, end: idx + needle.length });
    pos = idx + needle.length;
  }
  return out;
}

function applyReplacementsToParagraph(
  paragraph: string,
  replacements: PlannedReplacement[]
): string {
  if (replacements.length === 0) return paragraph;
  const runs = extractTextRuns(paragraph);
  if (runs.length === 0) return paragraph;

  const fullText = paragraphPlainText(runs);
  const charRunIdx: number[] = [];
  runs.forEach((run, index) => {
    for (let i = 0; i < run.text.length; i += 1) charRunIdx.push(index);
  });

  const sorted = [...replacements].sort((a, b) => a.start - b.start);
  type Seg = { text: string; openTag: string; rPr: string | null };
  const segs: Seg[] = [];

  const emitKept = (from: number, to: number) => {
    let i = from;
    while (i < to) {
      const runIdx = charRunIdx[i] ?? 0;
      let j = i + 1;
      while (j < to && charRunIdx[j] === runIdx) j += 1;
      const run = runs[runIdx];
      segs.push({ text: fullText.slice(i, j), openTag: run.openTag, rPr: run.rPr });
      i = j;
    }
  };

  let cursor = 0;
  for (const rep of sorted) {
    if (rep.start < cursor || rep.end > fullText.length) continue;
    if (rep.start > cursor) emitKept(cursor, rep.start);
    const sourceIdx = charRunIdx[Math.min(rep.start, Math.max(charRunIdx.length - 1, 0))] ?? 0;
    const sourceRun = runs[sourceIdx] ?? runs[0];
    segs.push({ text: rep.text, openTag: sourceRun.openTag, rPr: sourceRun.rPr });
    cursor = rep.end;
  }
  if (cursor < fullText.length) emitKept(cursor, fullText.length);

  const coalesced: Seg[] = [];
  for (const seg of segs) {
    if (!seg.text) continue;
    const prev = coalesced[coalesced.length - 1];
    if (prev && prev.openTag === seg.openTag && prev.rPr === seg.rPr) {
      prev.text += seg.text;
    } else {
      coalesced.push({ ...seg });
    }
  }

  const newRunsXml = coalesced.map((seg) => makeTextRun(seg.openTag, seg.rPr, seg.text)).join("");
  const first = runs[0].absStart;
  const last = runs[runs.length - 1].absEnd;
  return `${paragraph.slice(0, first)}${newRunsXml}${paragraph.slice(last)}`;
}

function isPartnerCeoSignatureLine(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!/^대표이사\s*:/.test(normalized) || !/\(인\)\s*$/.test(normalized)) return false;
  if (/김민준|김영광|김\s*민\s*준|김\s*영\s*광/.test(normalized)) return false;
  if (/^대표이사\s*:\s*\(인\)$/.test(normalized)) return true;
  if (/^대표이사\s*:\s*(?:O\s*)+\(인\)$/.test(normalized)) return true;
  // empty partner line with spaces before (인)
  if (/^대표이사\s*:\s+\(인\)$/.test(normalized)) return true;
  return false;
}

function rebuildPartnerCeoParagraph(paragraph: string, ceo: string): string {
  const runs = extractTextRuns(paragraph);
  const base = runs[0];
  const openTag = base?.openTag ?? "<w:r>";
  const rPr =
    base?.rPr ??
    `<w:rPr><w:rFonts w:ascii="Pretendard" w:eastAsia="Pretendard" w:hAnsi="Pretendard"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>`;

  let next = paragraph;
  const tabPos = 4000;
  const tabXml = `<w:tabs><w:tab w:val="right" w:pos="${tabPos}"/></w:tabs>`;
  if (/<w:pPr>[\s\S]*?<\/w:pPr>/.test(next)) {
    if (/<w:tabs>[\s\S]*?<\/w:tabs>/.test(next)) {
      next = next.replace(/<w:tabs>[\s\S]*?<\/w:tabs>/, (tabs) => {
        if (/w:val="right"/.test(tabs)) {
          return tabs.replace(
            /<w:tab\b[^>]*w:val="right"[^/]*\/>/,
            `<w:tab w:val="right" w:pos="${tabPos}"/>`
          );
        }
        return tabs.replace(/<\/w:tabs>/, `<w:tab w:val="right" w:pos="${tabPos}"/></w:tabs>`);
      });
    } else {
      next = next.replace(/<w:pPr>/, `<w:pPr>${tabXml}`);
    }
  } else {
    next = next.replace(/<w:p\b([^>]*)>/, `<w:p$1><w:pPr>${tabXml}</w:pPr>`);
  }

  const left = makeTextRun(openTag, rPr, `대표이사 : ${ceo}`);
  const tabRun = `${openTag}${rPr}<w:tab/></w:r>`;
  const right = makeTextRun(openTag, rPr, "(인)");
  const rebuiltRuns = `${left}${tabRun}${right}`;

  const latestRuns = extractTextRuns(next);
  if (latestRuns.length === 0) {
    return next.replace(/<\/w:p>\s*$/, `${rebuiltRuns}</w:p>`);
  }
  const first = latestRuns[0].absStart;
  const last = latestRuns[latestRuns.length - 1].absEnd;
  return `${next.slice(0, first)}${rebuiltRuns}${next.slice(last)}`;
}

function planReplacements(text: string, values: AgreementValues): PlannedReplacement[] {
  const { company, ceo, biz, dateKo } = values;
  const planned: PlannedReplacement[] = [];

  const add = (start: number, end: number, replacement: string) => {
    if (start >= end) return;
    planned.push({ start, end, text: replacement });
  };

  // 서명란 (파트너 빈 칸)
  if (/^상호\s*:\s*$/.test(text)) {
    add(0, text.length, `상호 : ${company}`);
    return planned;
  }
  if (/^사업자등록번호\s*:\s*$/.test(text)) {
    add(0, text.length, `사업자등록번호 : ${biz}`);
    return planned;
  }

  // 문서 일자 (단독 문단)
  if (text.trim() === SAMPLE_DATE) {
    add(0, text.length, dateKo);
    return planned;
  }

  for (const hit of findAllOccurrences(text, SAMPLE_DATE)) {
    add(hit.start, hit.end, dateKo);
  }

  // 본문 파트너명 플레이스홀더 (벤더 서명란의 OOOOO는 없음)
  for (const hit of findAllOccurrences(text, "OOOOO")) {
    add(hit.start, hit.end, company);
  }

  // unused but keep for type completeness in future templates
  void ceo;

  return planned;
}

function transformParagraph(paragraph: string, values: AgreementValues): string {
  const runs = extractTextRuns(paragraph);
  if (runs.length === 0) return paragraph;
  const text = paragraphPlainText(runs);

  if (isPartnerCeoSignatureLine(text)) {
    return rebuildPartnerCeoParagraph(paragraph, values.ceo);
  }

  const planned = planReplacements(text, values);
  if (planned.length === 0) return paragraph;
  return applyReplacementsToParagraph(paragraph, planned);
}

function replaceInXmlDocument(xml: string, values: AgreementValues): string {
  const parts: string[] = [];
  let last = 0;
  const re = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    parts.push(xml.slice(last, match.index));
    parts.push(transformParagraph(match[0], values));
    last = match.index + match[0].length;
  }
  parts.push(xml.slice(last));
  return parts.join("");
}

function buildFilename(company: string, agreementDate: string): string {
  const safeCompany = company.replace(/[\\/:*?"<>|]/g, "_").trim() || "partner";
  return `플래티넘_부속합의서_${safeCompany}_${formatContractFilenameDate(agreementDate)}.docx`;
}

export async function generatePlatinumAgreementDocx(
  input: PlatinumAgreementInput
): Promise<PlatinumAgreementDocxResult> {
  const company = normalizeContractCompanyName(input.companyName);
  const ceo = input.ceoName.trim();
  const biz = formatBusinessNumberDisplay(input.businessNumber);
  if (!company) return { ok: false, message: "상호(회사명)가 필요합니다." };
  if (!ceo) return { ok: false, message: "대표이사가 필요합니다." };
  if (!biz) return { ok: false, message: "사업자등록번호가 필요합니다." };

  let dateKo: string;
  try {
    dateKo = formatContractKoreanDate(input.agreementDate);
  } catch {
    return { ok: false, message: "문서 마지막 계약일 형식이 올바르지 않습니다. (YYYY-MM-DD)" };
  }

  const templatePath = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    "templates",
    "partner-contracts",
    "platinum-agreement-v1.1.docx"
  );
  if (!fs.existsSync(templatePath)) {
    return { ok: false, message: `템플릿 파일이 없습니다: templates/partner-contracts/${TEMPLATE_FILE}` };
  }

  const values: AgreementValues = { company, ceo, biz, dateKo };
  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !isRelevantXmlPath(entry.name)) continue;
    const xml = await entry.async("string");
    zip.file(entry.name, replaceInXmlDocument(xml, values));
  }

  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) {
    return { ok: false, message: "템플릿 document.xml을 읽을 수 없습니다." };
  }

  const plainText = extractPlainText(documentXml);
  const remaining: string[] = [];
  if (plainText.includes("OOOOO")) remaining.push("OOOOO");
  if (plainText.includes(SAMPLE_DATE) && SAMPLE_DATE !== dateKo) {
    remaining.push(SAMPLE_DATE);
  }
  // partner empty signature should be filled
  if (/^상호\s*:\s*$/m.test(plainText) || /상호\s*:\s*\n/.test(plainText)) {
    // loose check — look for empty partner block after vendor
  }
  if (remaining.length > 0) {
    return {
      ok: false,
      message: "문서 치환 후 플레이스홀더가 남아 있습니다.",
      remainingPlaceholders: remaining
    };
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
  return {
    ok: true,
    filename: buildFilename(company, input.agreementDate),
    buffer,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    plainText
  };
}
