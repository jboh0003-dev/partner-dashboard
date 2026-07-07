/** OOXML / PPTX XML fragments that must never appear in stored policy text */
const BAD_PARSE_PATTERNS = [
  /<a:/i,
  /<p:/i,
  /<r:/i,
  /xmlns/i,
  /cNvPr/i,
  /defRPr/i,
  /solidFill/i,
  /schemeClr/i,
  /tblPr/i,
  /tabLst/i,
  /endParaRPr/i,
  /<\/a:/i,
  /<\/p:/i
];

const USELESS_LINE = /^[\d\s.,:;·\-–—/\\()]+$/;

export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function isBadParseContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return true;
  return BAD_PARSE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function sanitizePolicyText(value: string): string {
  let text = decodeXmlEntities(value);
  text = text.replace(/<[^>]+>/g, "");
  text = text.replace(/\s+/g, (match) => (match.includes("\n") ? "\n" : " "));
  return text.trim();
}

export function isUselessPolicyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 2) return true;
  if (USELESS_LINE.test(trimmed)) return true;
  if (/^v\d+$/i.test(trimmed)) return true;
  if (/^\d+\.\d+$/.test(trimmed)) return true;
  if (/^contents\.?$/i.test(trimmed)) return true;
  return false;
}

export function normalizePolicyParagraphs(lines: string[]): string {
  const cleaned = lines
    .map((line) => line.trim())
    .filter((line) => !isUselessPolicyLine(line));

  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function xmlTagRatio(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 1;
  const tagMatches = trimmed.match(/<[^>]+>/g) ?? [];
  const tagChars = tagMatches.join("").length;
  return tagChars / trimmed.length;
}
