import { classifyDocumentType } from "@/lib/documents/classify";
import type { DocumentType } from "@/lib/documents/constants";
import { buildAutoDisplayName } from "@/lib/documents/display";
import { normalizeCompanyName } from "@/lib/partner-match";

export type ParsedFilenameMetadata = {
  original_filename: string;
  document_type: DocumentType;
  extracted_partner_name: string | null;
  filename_partner_candidates: string[];
  normalized_company_name: string | null;
  contract_date: string | null;
  grade_from_file: string | null;
  partner_no: string | null;
  display_name: string;
};

const CONTRACT_FILENAME =
  /^\((\d{6})\)\s*(\d{1,4})_[^_]*계약서_(.+)\.(pdf|docx?|hwp|zip|xlsx?|pptx?|png|jpe?g)$/i;

const GRADE_IN_PARENS = /\((플래티넘|골드|실버|Platinum|Gold|Silver)[^)]*\)/i;
const DATE_YYYYMMDD = /(?:^|[^\d])(20\d{2})(\d{2})(\d{2})(?:[^\d]|$)/;
const DATE_YYMMDD = /(?:^|[^\d])(\d{2})(\d{2})(\d{2})(?:[^\d]|$)/;

const DOCUMENT_LABEL =
  /^(파트너\s*)?(신청서|계약서|기술파트너\s*신청서|company\s*profile|신용평가|보안확약서|회사소개서)$/i;

export function parseFilenameMetadata(
  originalFilename: string,
  options: {
    relativePath?: string;
    sourceFolder?: string;
    folderPartnerName?: string | null;
  } = {}
): ParsedFilenameMetadata {
  const relativePath = options.relativePath ?? originalFilename;
  const contractMeta = parseContractFilename(originalFilename);
  const documentType =
    contractMeta?.document_type ?? classifyDocumentType(originalFilename);

  const filenameCandidates = extractFilenamePartnerCandidates(originalFilename);
  const filenamePartnerName =
    contractMeta?.company_name_raw ?? filenameCandidates[0] ?? null;
  const extractedPartnerName = cleanCompanyName(filenamePartnerName) ?? null;

  const gradeFromFile =
    contractMeta?.grade_from_file ??
    extractGradeFromText(originalFilename) ??
    extractGradeFromText(extractedPartnerName);

  const partnerNameWithoutGrade = extractedPartnerName
    ? stripGradeFromCompanyName(extractedPartnerName)
    : null;

  return {
    original_filename: originalFilename,
    document_type: documentType,
    extracted_partner_name: partnerNameWithoutGrade,
    filename_partner_candidates: filenameCandidates,
    normalized_company_name: normalizeCompanyName(partnerNameWithoutGrade),
    contract_date:
      contractMeta?.contract_date ??
      extractDateFromText(originalFilename) ??
      extractDateFromText(relativePath),
    grade_from_file: gradeFromFile,
    partner_no: contractMeta?.partner_no ?? null,
    display_name: buildAutoDisplayName({
      document_type: documentType,
      original_filename: originalFilename
    })
  };
}

/** 파일명에서 파트ner명 후보를 여러 패턴으로 추출 */
export function extractFilenamePartnerCandidates(filename: string): string[] {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const candidates = new Set<string>();

  const contractTail = withoutExt.match(/계약서_(.+)$/i);
  if (contractTail?.[1]) {
    const cleaned = cleanCompanyName(contractTail[1]);
    if (cleaned) candidates.add(cleaned);
  }

  for (const match of withoutExt.matchAll(/\(([^)]+)\)/g)) {
    const inner = cleanCompanyName(match[1]);
    if (inner && !isGradeLabel(inner) && inner.length >= 2) {
      candidates.add(inner);
    }
  }

  const parts = withoutExt.split("_").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const cleaned = cleanCompanyName(part);
    if (!cleaned || cleaned.length < 2) continue;
    if (isDocumentLabelSegment(cleaned)) continue;
    if (isDateLikeSegment(cleaned)) continue;
    if (/^v\d+$/i.test(cleaned)) continue;
    candidates.add(cleaned);
  }

  if (parts.length >= 2) {
    const middle = parts[parts.length - 2];
    const middleClean = cleanCompanyName(middle ?? "");
    if (middleClean && !isDocumentLabelSegment(middleClean) && !isDateLikeSegment(middleClean)) {
      candidates.add(middleClean);
    }
  }

  return Array.from(candidates).filter((value) => value.length >= 2);
}

export function findPartnerNamesMentionedInFilename(
  filename: string,
  partners: Array<{ company_name: string }>
): string[] {
  const normalizedHaystack = normalizeCompanyName(filename) ?? "";
  const lowerHaystack = filename.toLowerCase();
  const found: string[] = [];

  for (const partner of partners) {
    const norm = normalizeCompanyName(partner.company_name);
    if (norm && norm.length >= 3 && normalizedHaystack.includes(norm)) {
      found.push(partner.company_name);
      continue;
    }

    const parenMatch = partner.company_name.match(/\(([^)]+)\)/);
    if (parenMatch?.[1]) {
      const alias = parenMatch[1].trim();
      if (alias.length >= 2 && lowerHaystack.includes(alias.toLowerCase())) {
        found.push(alias);
      }
    }

    const primary = partner.company_name.replace(/\([^)]+\)/, "").trim();
    const primaryNorm = normalizeCompanyName(primary);
    if (primaryNorm && primaryNorm.length >= 3 && normalizedHaystack.includes(primaryNorm)) {
      found.push(primary);
    }
  }

  return Array.from(new Set(found));
}

function parseContractFilename(filename: string) {
  const match = filename.match(CONTRACT_FILENAME);
  if (!match) return null;

  const [, yymmdd, partnerNo, rawCompanyPart] = match;
  const gradeInfo = parseGradeTransition(rawCompanyPart.trim());

  return {
    document_type: "partner_contract" as DocumentType,
    contract_date: parseYymmddToIso(yymmdd),
    partner_no: normalizePartnerNo(partnerNo),
    company_name_raw: cleanCompanyName(gradeInfo.companyName),
    grade_from_file: gradeInfo.grade
  };
}

function parseGradeTransition(value: string) {
  const transitionMatch = value.match(/^(.+?)\((.+)\)$/);
  if (!transitionMatch) {
    return {
      companyName: value,
      grade: extractGradeFromText(value)
    };
  }

  return {
    companyName: transitionMatch[1].trim(),
    grade: normalizeGradeLabel(transitionMatch[2].trim())
  };
}

function isDocumentLabelSegment(value: string): boolean {
  return DOCUMENT_LABEL.test(value.trim());
}

function isDateLikeSegment(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 6 && digits.length <= 8;
}

function isGradeLabel(value: string): boolean {
  return /^(플래티넘|골드|실버|platinum|gold|silver)$/i.test(value.trim());
}

function extractDateFromText(value: string): string | null {
  const yyyymmdd = value.match(DATE_YYYYMMDD);
  if (yyyymmdd) {
    return toIsoDate(Number(yyyymmdd[1]), Number(yyyymmdd[2]), Number(yyyymmdd[3]));
  }

  const yymmdd = value.match(DATE_YYMMDD);
  if (yymmdd) {
    return parseYymmddToIso(`${yymmdd[1]}${yymmdd[2]}${yymmdd[3]}`);
  }

  return null;
}

function extractGradeFromText(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(GRADE_IN_PARENS);
  if (!match) return null;
  return normalizeGradeLabel(match[1]);
}

function normalizeGradeLabel(value: string): string | null {
  const text = value
    .replace(/[▶→>-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .pop();

  if (!text) return null;
  if (/플래티넘|platinum/i.test(text)) return "Platinum";
  if (/골드|gold/i.test(text)) return "Gold";
  if (/실버|silver/i.test(text)) return "Silver";
  return text;
}

function cleanCompanyName(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  let text = value
    .replace(/\[접수[_\s-]*\d+\]/gi, "")
    .replace(/\[보류\]/gi, "")
    .replace(/\(보류\)/gi, "")
    .replace(/㈜/g, "")
    .replace(/\(주\)/gi, "")
    .replace(/주식회사/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  text = stripGradeFromCompanyName(text);
  return text || null;
}

function stripGradeFromCompanyName(value: string): string {
  return value.replace(/\((?:플래티넘|골드|실버|Silver|Gold|Platinum)[^)]*\)$/i, "").trim();
}

function normalizePartnerNo(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value.trim();
  return String(parseInt(digits, 10));
}

function parseYymmddToIso(value: string): string | null {
  if (value.length !== 6) return null;
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  return toIsoDate(year, month, day);
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (!month || !day || month > 12 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
