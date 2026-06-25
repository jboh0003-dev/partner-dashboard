import type { DocumentType } from "@/lib/documents/constants";
import { buildAutoDisplayName } from "@/lib/documents/display";
import {
  extractFolderPartnerHintFromPath,
  normalizeFolderPartnerName,
  parseFolderPartnerHint
} from "@/lib/documents/folder-parser";
import { parseFilenameMetadata } from "@/lib/documents/filename-parser";
import { normalizeCompanyName } from "@/lib/partner-match";

export type PartnerNameSource = "folder" | "filename";

export type ParsedPartnerDocumentFile = {
  row_number: number;
  client_key: string;
  original_filename: string;
  display_name: string;
  relative_path: string;
  source_folder: string;
  source_folder_name: string | null;
  folder_normalized_name: string | null;
  is_generic_folder: boolean;
  source_file: string;
  file_ext: string;
  file_size: number;
  document_type: DocumentType;
  partner_name_raw: string | null;
  partner_name_source: PartnerNameSource | null;
  folder_match_candidates: string[];
  filename_partner_name: string | null;
  filename_partner_candidates: string[];
  normalized_company_name: string | null;
  contract_date: string | null;
  received_date: string | null;
  partner_no: string | null;
  grade_from_file: string | null;
  period_year: number | null;
  period_quarter: string | null;
  period_month: number | null;
  note: string | null;
};

const CONTRACT_FILENAME =
  /^\((\d{6})\)\s*(\d{1,4})_[^_]*계약서_(.+)\.(pdf|docx?|hwp|zip|xlsx?|pptx?|png|jpe?g)$/i;

const PERIOD_ONLY_FOLDER =
  /^(20\d{2}\s*년|\d\s*분기|\d{1,2}\s*월|플래티넘\s*파트너|파트너\s*신청서|파트너\s*계약서)$/i;

export function parsePartnerDocumentFile(
  file: File,
  rowNumber: number
): ParsedPartnerDocumentFile {
  const relativePath = getRelativePath(file);
  const originalFilename = file.name;
  const sourceFolder = extractSourceFolder(relativePath);
  const pathContext = parsePathContext(relativePath, sourceFolder);
  const folderHint = extractFolderPartnerHintFromPath(relativePath, sourceFolder);
  const parsedMeta = parseFilenameMetadata(originalFilename, { relativePath });

  const folderPartnerName =
    folderHint && !folderHint.is_generic_folder ? folderHint.primary : null;
  const filenamePartnerName = parsedMeta.extracted_partner_name;
  const filenameCandidates = parsedMeta.filename_partner_candidates;

  let partnerNameRaw = folderPartnerName ?? filenamePartnerName;
  let partnerNameSource: PartnerNameSource | null = folderPartnerName
    ? "folder"
    : filenamePartnerName
      ? "filename"
      : null;

  if (folderHint?.is_generic_folder) {
    partnerNameRaw = filenamePartnerName;
    partnerNameSource = filenamePartnerName ? "filename" : null;
  }

  partnerNameRaw = cleanCompanyName(partnerNameRaw);

  const gradeFromFile =
    parsedMeta.grade_from_file ?? extractGradeFromText(partnerNameRaw);

  if (gradeFromFile && partnerNameRaw) {
    partnerNameRaw = stripGradeFromCompanyName(partnerNameRaw);
  }

  const documentType = parsedMeta.document_type;
  const contractMeta = parseContractFilename(originalFilename);

  return {
    row_number: rowNumber,
    client_key: `${relativePath || originalFilename}::${file.size}::${file.lastModified}`,
    original_filename: originalFilename,
    display_name: buildAutoDisplayName({
      document_type: documentType,
      original_filename: originalFilename
    }),
    relative_path: relativePath,
    source_folder: sourceFolder,
    source_folder_name: folderHint?.source_folder_name ?? null,
    folder_normalized_name: folderHint?.normalized_name ?? null,
    is_generic_folder: folderHint?.is_generic_folder ?? false,
    source_file: relativePath || originalFilename,
    file_ext: extractExtension(originalFilename),
    file_size: file.size,
    document_type: documentType,
    partner_name_raw: partnerNameRaw,
    partner_name_source: partnerNameSource,
    folder_match_candidates: folderHint?.is_generic_folder ? [] : (folderHint?.match_candidates ?? []),
    filename_partner_name: filenamePartnerName,
    filename_partner_candidates: filenameCandidates,
    normalized_company_name: normalizeCompanyName(partnerNameRaw),
    contract_date: parsedMeta.contract_date,
    received_date: pathContext.received_date,
    partner_no: parsedMeta.partner_no ?? contractMeta?.partner_no ?? null,
    grade_from_file: gradeFromFile,
    period_year: pathContext.period_year,
    period_quarter: pathContext.period_quarter,
    period_month: pathContext.period_month,
    note: contractMeta?.grade_note ?? null
  };
}

export function extractPartnerNameFromFolderPath(sourceFolder: string): string | null {
  const segments = sourceFolder.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) return null;

  const hint = parseFolderPartnerHint(lastSegment);
  return hint?.primary ?? null;
}

export function cleanFolderSegment(value: string): string | null {
  return normalizeFolderPartnerName(value);
}

function getRelativePath(file: File): string {
  const fileWithPath = file as File & { webkitRelativePath?: string };
  return (fileWithPath.webkitRelativePath ?? file.name).replace(/\\/g, "/");
}

function extractSourceFolder(relativePath: string): string {
  if (!relativePath.includes("/")) return "";
  const parts = relativePath.split("/");
  parts.pop();
  return parts.join("/");
}

function parsePathContext(relativePath: string, sourceFolder: string) {
  const haystack = `${sourceFolder}/${relativePath}`.replace(/\\/g, "/");
  const yearMatch = haystack.match(/(20\d{2})\s*년/);
  const quarterMatch = haystack.match(/(20\d{2})\s*년?\s*(\d)\s*분기|(\d)\s*분기/);
  const monthMatch = haystack.match(/(?:^|\/)(\d{1,2})\s*월(?:\/|$)/);
  const receivedMatch =
    sourceFolder.match(/\[접수[_\s-]*(\d{4})\]/i) ??
    haystack.match(/\[접수[_\s-]*(\d{4})\]/i);

  const periodYear = yearMatch ? Number(yearMatch[1]) : null;
  const periodQuarter = quarterMatch
    ? `${quarterMatch[2] ?? quarterMatch[3] ?? ""}`.trim()
      ? `${quarterMatch[2] ?? quarterMatch[3]}분기`
      : null
    : null;
  const periodMonth = monthMatch ? Number(monthMatch[1]) : null;

  let receivedDate: string | null = null;
  if (receivedMatch) {
    const mmdd = receivedMatch[1];
    const year = periodYear ?? inferYearFromPath(haystack) ?? new Date().getFullYear();
    receivedDate = parseMmddToIso(year, mmdd);
  }

  return {
    period_year: periodYear,
    period_quarter: periodQuarter,
    period_month: periodMonth,
    received_date: receivedDate
  };
}

function parseContractFilename(filename: string) {
  const match = filename.match(CONTRACT_FILENAME);
  if (!match) return null;

  const [, yymmdd, partnerNo, rawCompanyPart] = match;
  const companyWithGrade = rawCompanyPart.trim();
  const gradeInfo = parseGradeTransition(companyWithGrade);

  return {
    document_type: "partner_contract" as DocumentType,
    contract_date: parseYymmddToIso(yymmdd),
    partner_no: normalizePartnerNoFromFilename(partnerNo),
    company_name_raw: cleanCompanyName(gradeInfo.companyName),
    grade_from_file: gradeInfo.grade,
    grade_note: gradeInfo.note
  };
}

function normalizePartnerNoFromFilename(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return value.trim();
  return String(parseInt(digits, 10));
}

function parseGradeTransition(value: string) {
  const transitionMatch = value.match(/^(.+?)\((.+)\)$/);
  if (!transitionMatch) {
    return {
      companyName: value,
      grade: extractGradeFromText(value),
      note: null as string | null
    };
  }

  const companyName = transitionMatch[1].trim();
  const gradeRaw = transitionMatch[2].trim();
  const normalizedGrade = normalizeGradeLabel(gradeRaw);
  const note = /[▶→>-]/.test(gradeRaw) ? `등급 변경: ${gradeRaw}` : null;

  return {
    companyName,
    grade: normalizedGrade,
    note
  };
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


function cleanCompanyName(value: string | null): string | null {
  if (!value) return null;
  const cleaned = cleanFolderSegment(value);
  return cleaned || null;
}

function stripGradeFromCompanyName(value: string): string {
  return value.replace(/\((?:플래티넘|골드|실버|Silver|Gold|Platinum)[^)]*\)$/i, "").trim();
}

function extractGradeFromText(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/\(([^)]+)\)\s*$/);
  if (!match) return null;
  return normalizeGradeLabel(match[1]);
}


function extractExtension(filename: string): string {
  const match = filename.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function parseYymmddToIso(value: string): string | null {
  if (value.length !== 6) return null;
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (!month || !day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseMmddToIso(year: number, mmdd: string): string | null {
  if (mmdd.length !== 4) return null;
  const month = Number(mmdd.slice(0, 2));
  const day = Number(mmdd.slice(2, 4));
  if (!month || !day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferYearFromPath(path: string): number | null {
  const match = path.match(/(20\d{2})/);
  return match ? Number(match[1]) : null;
}

export function computeDocumentPriorityScore(input: {
  source_folder: string;
  period_year: number | null;
  period_quarter: string | null;
  period_month: number | null;
  received_date: string | null;
  contract_date: string | null;
}): number {
  let score = 0;
  if (input.source_folder.includes("플래티넘 파트너")) score += 1_000_000;
  score += (input.period_year ?? 0) * 10_000;
  score += quarterToNumber(input.period_quarter) * 1_000;
  score += (input.period_month ?? 0) * 100;
  score += dateToScore(input.received_date);
  score += dateToScore(input.contract_date);
  return score;
}

function quarterToNumber(value: string | null): number {
  if (!value) return 0;
  const match = value.match(/(\d)/);
  return match ? Number(match[1]) : 0;
}

function dateToScore(value: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.floor(time / 86_400_000) : 0;
}
