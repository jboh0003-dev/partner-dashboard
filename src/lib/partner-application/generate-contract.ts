/**
 * 파트너 계약서 DOCX 치환
 * - document/header/footer/footnotes/endnotes
 * - 문단 텍스트를 합쳐 위치를 찾은 뒤, 치환 구간만 새 run으로 재작성
 * - 원본에서 강조된 구간은 bold + underline 유지/적용
 * - 서명란 (인)은 우측 탭 정렬
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import {
  formatBusinessNumberDisplay,
  formatContractFilenameDate,
  formatContractKoreanDate,
  normalizeContractCompanyName,
  PARTNER_CONTRACT_GRADE_LABEL,
  type PartnerContractGrade
} from "@/lib/partner-application/contract-dates";

export type ContractGenerateInput = {
  grade: PartnerContractGrade;
  companyNameContract: string;
  ceoName: string;
  businessNumber: string;
  contractStartDate: string;
  contractEndDate: string;
};

export type ContractGenerateResult =
  | {
      ok: true;
      filename: string;
      buffer: Buffer;
      contentType: string;
    }
  | {
      ok: false;
      message: string;
      missingItems?: string[];
      remainingPlaceholders?: string[];
    };

type ContractValues = {
  company: string;
  ceo: string;
  biz: string;
  startKo: string;
  endKo: string;
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
  /** 원본 구간에 bold/underline이 있으면 강조 적용 */
  emphasizeIfSource: boolean;
};

const SAMPLE_DATES = ["2026년 06월 30일", "2027년 06월 29일"] as const;

const DATE_PLACEHOLDERS = [
  "2027년 0월 0일",
  "2027년 O월 OO일",
  "2027년   O월   OO일",
  "2026년 0월 0일",
  "2026년 O월 OO일",
  "2026년   O월   OO일"
] as const;

function templatePath(grade: PartnerContractGrade): string {
  return path.join(process.cwd(), "templates", "partner-contracts", `${grade}.docx`);
}

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

export function extractPlainText(xml: string): string {
  return unescapeXml(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br[^/]*\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
  );
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
    name.endsWith("endnotes.xml") ||
    name.includes("glossary/document.xml")
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

function runHasEmphasis(rPr: string | null): boolean {
  if (!rPr) return false;
  return /<w:b(?:Cs)?[\s/>]/.test(rPr) || /<w:u[\s/>]/.test(rPr);
}

function ensureEmphasis(rPr: string | null, fallbackRPr: string | null): string {
  const source = rPr ?? fallbackRPr ?? "<w:rPr></w:rPr>";
  let inner = source.replace(/^<w:rPr>/, "").replace(/<\/w:rPr>$/, "");
  inner = inner
    .replace(/<w:bCs\s*\/>/g, "")
    .replace(/<w:b\b[^/]*\/>/g, "")
    .replace(/<w:u\b[^/]*\/>/g, "");
  inner += `<w:b/><w:bCs/><w:u w:val="single"/>`;
  return `<w:rPr>${inner}</w:rPr>`;
}

function makeTextRun(openTag: string, rPr: string | null, text: string): string {
  const space = /^\s|\s$/.test(text) || text.includes("  ") ? ` xml:space="preserve"` : "";
  return `${openTag}${rPr ?? ""}<w:t${space}>${escapeXml(text)}</w:t></w:r>`;
}

function paragraphPlainText(runs: TextRun[]): string {
  return runs.map((run) => run.text).join("");
}

function rangeEmphasized(runs: TextRun[], start: number, end: number): boolean {
  let offset = 0;
  for (const run of runs) {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    offset = runEnd;
    if (runEnd <= start || runStart >= end) continue;
    if (runHasEmphasis(run.rPr)) return true;
  }
  return false;
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

function claimRange(used: boolean[], start: number, end: number): boolean {
  for (let i = start; i < end; i += 1) {
    if (used[i]) return false;
  }
  for (let i = start; i < end; i += 1) used[i] = true;
  return true;
}

function isPartnerCeoSignatureLine(text: string): boolean {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!/^대표이사\s*:/.test(normalized) || !/\(인\)\s*$/.test(normalized)) return false;
  if (/김민준|김영광|김\s*민\s*준|김\s*영\s*광/.test(normalized)) return false;
  if (/^대표이사\s*:\s*\(인\)$/.test(normalized)) return true;
  if (/^대표이사\s*:\s*(?:O\s*)+\(인\)$/.test(normalized)) return true;
  return false;
}

function rebuildPartnerCeoParagraph(paragraph: string, ceo: string, tabPos: number): string {
  const runs = extractTextRuns(paragraph);
  const base = runs[0];
  const openTag = base?.openTag ?? "<w:r>";
  const rPr =
    base?.rPr ??
    `<w:rPr><w:rFonts w:ascii="Pretendard" w:eastAsia="Pretendard" w:hAnsi="Pretendard"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>`;

  let next = paragraph;
  const tabXml = `<w:tabs><w:tab w:val="right" w:pos="${tabPos}"/></w:tabs>`;
  if (/<w:pPr>[\s\S]*?<\/w:pPr>/.test(next)) {
    if (/<w:tabs>[\s\S]*?<\/w:tabs>/.test(next)) {
      next = next.replace(/<w:tabs>[\s\S]*?<\/w:tabs>/, (tabs) => {
        if (/w:val="right"/.test(tabs)) {
          return tabs.replace(/<w:tab\b[^>]*w:val="right"[^/]*\/>/, `<w:tab w:val="right" w:pos="${tabPos}"/>`);
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
    const shouldEmphasize =
      rep.emphasizeIfSource && rangeEmphasized(runs, rep.start, rep.end);
    const rPr = shouldEmphasize
      ? ensureEmphasis(sourceRun.rPr, runs.find((r) => runHasEmphasis(r.rPr))?.rPr ?? sourceRun.rPr)
      : sourceRun.rPr;
    segs.push({ text: rep.text, openTag: sourceRun.openTag, rPr });
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

function planReplacements(text: string, values: ContractValues): PlannedReplacement[] {
  const { company, ceo, biz, startKo, endKo } = values;
  const used = Array.from({ length: text.length }, () => false);
  const planned: PlannedReplacement[] = [];

  const add = (start: number, end: number, replacement: string, emphasizeIfSource: boolean) => {
    if (start >= end) return;
    if (!claimRange(used, start, end)) return;
    planned.push({ start, end, text: replacement, emphasizeIfSource });
  };

  const addAll = (needle: string, replacement: string, emphasizeIfSource: boolean) => {
    for (const hit of findAllOccurrences(text, needle)) {
      add(hit.start, hit.end, replacement, emphasizeIfSource);
    }
  };

  // 서명란 전체 문단
  if (/^상호\s*:\s*$/.test(text)) {
    add(0, text.length, `상호 : ${company}`, false);
    return planned;
  }
  if (/^사업자등록번호\s*:\s*$/.test(text)) {
    add(0, text.length, `사업자등록번호 : ${biz}`, false);
    return planned;
  }
  if (/^상호\s*:\s*주식회사\s*O{3,}\s*$/.test(text)) {
    add(0, text.length, `상호 : ${company}`, false);
    return planned;
  }
  if (/^사업자등록번호\s*:\s*O{2,}-O{2}-O{4,}\s*$/.test(text)) {
    add(0, text.length, `사업자등록번호 : ${biz}`, false);
    return planned;
  }

  // 종료일 → 시작일 (개별 치환으로 '부터/까지' 원본 서식 유지)
  addAll("2027년 0월 0일", endKo, true);
  addAll("2027년 O월 OO일", endKo, true);
  addAll("2027년   O월   OO일", endKo, true);

  addAll("2026년 0월 0일", startKo, true);
  addAll("2026년 O월 OO일", startKo, true);
  addAll("2026년   O월   OO일", startKo, true);

  // 사업자번호 먼저 (OOOO 충돌 방지)
  addAll("OOO-OO-OOOOO", biz, false);

  // 회사명 (긴 토큰 우선)
  addAll("주식회사 OOOO", company, true);
  addAll("OOOOOO", company, true);
  addAll("OOOOO", company, true);

  // 남은 OOOO — 벤더 사업자번호 문단은 제외
  if (!/674-88-01017/.test(text)) {
    addAll("OOOO", company, true);
  }

  addAll("【상호】", company, true);
  addAll("【대표이사】", ceo, false);
  addAll("【사업자등록번호】", biz, false);
  addAll("【계약시작일】", startKo, true);
  addAll("【계약종료일】", endKo, true);
  addAll("【계약일】", startKo, true);
  addAll("{{COMPANY_NAME}}", company, true);
  addAll("{{CEO_NAME}}", ceo, false);
  addAll("{{BUSINESS_NUMBER}}", biz, false);

  return planned;
}

function transformParagraph(paragraph: string, values: ContractValues, tabPos: number): string {
  const runs = extractTextRuns(paragraph);
  if (runs.length === 0) return paragraph;
  const text = paragraphPlainText(runs);

  if (isPartnerCeoSignatureLine(text)) {
    return rebuildPartnerCeoParagraph(paragraph, values.ceo, tabPos);
  }

  const planned = planReplacements(text, values);
  if (planned.length === 0) return paragraph;
  return applyReplacementsToParagraph(paragraph, planned);
}

function inferTabPos(xml: string, paragraphIndex: number): number {
  const before = xml.slice(Math.max(0, paragraphIndex - 800), paragraphIndex);
  const tcOpen = before.lastIndexOf("<w:tc");
  const tcClose = before.lastIndexOf("</w:tc>");
  if (tcOpen > tcClose) {
    const width = Number((before.slice(tcOpen).match(/<w:tcW[^>]*w:w="(\d+)"/) || [])[1] || 0);
    if (width > 0) return Math.max(width - 120, 800);
  }
  return 4000;
}

function replaceInXmlDocument(xml: string, values: ContractValues): string {
  const parts: string[] = [];
  let last = 0;
  const re = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) {
    parts.push(xml.slice(last, match.index));
    const tabPos = inferTabPos(xml, match.index);
    parts.push(transformParagraph(match[0], values, tabPos));
    last = match.index + match[0].length;
  }
  parts.push(xml.slice(last));
  return parts.join("");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectLeftoverIssues(plain: string, values: ContractValues): string[] {
  const issues: string[] = [];
  for (const token of DATE_PLACEHOLDERS) {
    if (plain.includes(token)) issues.push(`날짜 플레이스홀더 잔존: ${token}`);
  }
  for (const sample of SAMPLE_DATES) {
    if (sample !== values.startKo && sample !== values.endKo && plain.includes(sample)) {
      issues.push(`샘플 날짜 잔존: ${sample}`);
    }
  }
  for (const token of [
    "주식회사 OOOO",
    "OOOOOO",
    "OOOOO",
    "OOO-OO-OOOOO",
    "【상호】",
    "【대표이사】",
    "【사업자등록번호】",
    "【계약시작일】",
    "【계약종료일】",
    "【계약일】"
  ]) {
    if (plain.includes(token)) issues.push(`플레이스홀더 잔존: ${token}`);
  }
  if (/(?<![O])OOOO(?![O])/.test(plain)) {
    issues.push("플레이스홀더 잔존: OOOO");
  }
  if (values.company.startsWith("주식회사 ")) {
    const rest = values.company.slice("주식회사 ".length);
    if (rest && plain.includes(`주식회사${rest}`)) {
      issues.push(`회사명 붙여쓰기: 주식회사${rest}`);
    }
    if (rest && new RegExp(`주식회사\\s{2,}${escapeRegExp(rest)}`).test(plain)) {
      issues.push(`회사명 이중 공백: 주식회사  ${rest}`);
    }
  }
  return [...new Set(issues)];
}

export async function generatePartnerContractDocx(
  input: ContractGenerateInput
): Promise<ContractGenerateResult> {
  const company = normalizeContractCompanyName(input.companyNameContract);
  const ceo = input.ceoName.trim();
  const biz = formatBusinessNumberDisplay(input.businessNumber);
  const startKo = formatContractKoreanDate(input.contractStartDate);
  const endKo = formatContractKoreanDate(input.contractEndDate);
  const gradeLabel = PARTNER_CONTRACT_GRADE_LABEL[input.grade];

  if (!company) return { ok: false, message: "계약서 표기 회사명이 필요합니다." };
  if (!ceo) return { ok: false, message: "대표자명이 필요합니다." };
  if (!biz || biz.replace(/\D/g, "").length !== 10) {
    return { ok: false, message: "사업자등록번호(10자리)가 필요합니다." };
  }

  const filePath = templatePath(input.grade);
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      message: `계약서 템플릿이 없습니다. templates/partner-contracts/${input.grade}.docx 를 확인해 주세요.`
    };
  }

  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const values: ContractValues = { company, ceo, biz, startKo, endKo };
  const xmlPaths = Object.keys(zip.files).filter(isRelevantXmlPath);

  for (const xmlPath of xmlPaths) {
    const file = zip.file(xmlPath);
    if (!file) continue;
    const xml = await file.async("string");
    zip.file(xmlPath, replaceInXmlDocument(xml, values));
  }

  const plainParts: string[] = [];
  const docXml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  for (const xmlPath of xmlPaths) {
    const file = zip.file(xmlPath);
    if (!file) continue;
    plainParts.push(extractPlainText(await file.async("string")));
  }
  const plain = plainParts.join("\n");

  const missingItems: string[] = [];
  if (!plain.includes(company)) missingItems.push("회사명");
  if (!plain.includes(ceo)) missingItems.push("대표이사");
  if (!plain.includes(biz) && !plain.includes(biz.replace(/-/g, ""))) {
    missingItems.push("사업자등록번호");
  }
  if (!plain.includes(startKo)) missingItems.push("계약 시작일");
  if (!plain.includes(endKo)) missingItems.push("계약 종료일");
  if (!plain.includes(gradeLabel)) missingItems.push("계약등급");

  if (/^상호\s*:\s*$/m.test(plain) || /상호\s*:\s*\n/.test(plain)) {
    if (!missingItems.includes("회사명")) missingItems.push("회사명");
  }
  if (/사업자등록번호\s*:\s*$/m.test(plain)) {
    if (!missingItems.includes("사업자등록번호")) missingItems.push("사업자등록번호");
  }
  if (/대표이사\s*:\s*\(인\)/.test(plain) && !plain.includes(`대표이사 : ${ceo}`)) {
    if (!missingItems.includes("대표이사")) missingItems.push("대표이사");
  }

  const leftover = collectLeftoverIssues(plain, values);
  if (leftover.length > 0) {
    missingItems.push(...leftover);
  }

  // 서명란 (인) 탭 존재 여부 (파트너 측)
  if (docXml.includes(`대표이사 : ${escapeXml(ceo)}`) || docXml.includes(`대표이사 : ${ceo}`)) {
    const ceoPara = [...docXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
      .map((m) => m[0])
      .find((p) => extractPlainText(p).includes(`대표이사 : ${ceo}`) && extractPlainText(p).includes("(인)"));
    if (ceoPara && !/<w:tab\s*\/>/.test(ceoPara)) {
      missingItems.push("서명란 (인) 우측 정렬");
    }
  }

  if (missingItems.length > 0) {
    const unique = [...new Set(missingItems)];
    console.error("[partner-contract] replacement incomplete", {
      template: `${input.grade}.docx`,
      company,
      ceo,
      biz,
      startKo,
      endKo,
      gradeLabel,
      missingItems: unique
    });
    return {
      ok: false,
      message: `계약서 생성 중 ${unique.length}개 항목을 반영하지 못했습니다.\n${unique
        .map((item) => `- ${item}`)
        .join("\n")}`,
      missingItems: unique,
      remainingPlaceholders: unique
    };
  }

  const out = await zip.generateAsync({ type: "nodebuffer" });
  const safeCompany = company.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "");
  const filename = `OKESTRO_파트너계약서_${gradeLabel}_${safeCompany}_${formatContractFilenameDate(input.contractStartDate)}.docx`;

  return {
    ok: true,
    filename,
    buffer: Buffer.from(out),
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  };
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
