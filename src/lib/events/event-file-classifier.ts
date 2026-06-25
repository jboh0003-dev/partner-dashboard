import type { EventDocumentType, EventFileStatus, EventVisibility } from "@/lib/events/event-document-types";
import { EVENT_DOCUMENT_TYPE_LABEL } from "@/lib/events/event-document-types";
import { isEventFileOversized } from "@/lib/events/event-upload-limits";

export type EventFileInput = {
  originalFilename: string;
  sourcePath: string;
  fileExtension?: string | null;
  fileSize?: number | null;
  lastModified?: number | null;
};

export type ClassifiedEventFile = EventFileInput & {
  documentType: EventDocumentType;
  fileStatus: EventFileStatus;
  excludeReason: string | null;
  versionLabel: string | null;
  versionNumber: number | null;
  displayName: string;
  qualityScore: number;
  visibility: EventVisibility;
};

const DRAFT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /작업용|work\s*in\s*progress|\bwip\b/i, reason: "작업용 파일" },
  { pattern: /중간본|중간\s*본|draft|초안|임시|temp\b|~$/i, reason: "중간본/초안/임시" }
];

const OLD_VERSION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(v|ver|version)\s*0*[1-3]\b/i, reason: "낮은 버전 번호" }
];

const DUPLICATE_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /복사본|copy\s*of|\(\d+\)\.|duplicate/i, reason: "복사본" }
];

const EXCLUDED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /참고자료|reference|타사|sample/i, reason: "타회사 참고자료" },
  { pattern: /\.(zip|rar|7z|tar|gz)$/i, reason: "압축 보관파일" },
  { pattern: /\.(mp4|mov|avi|mkv|wmv)$/i, reason: "영상 파일" },
  { pattern: /원본\s*사진|raw\s*photo|camera\s*roll/i, reason: "원본 사진 묶음" }
];

const INTERNAL_PATTERNS: RegExp[] = [
  /quotation|견적|비용|cost|estimate|내부|internal|prep|준비\s*자료/i
];

const REPRESENTATIVE_CANDIDATE_PATTERNS: RegExp[] = [
  /\bfinal\b/i,
  /최종/,
  /공유용/,
  /배포용/,
  /발표용/,
  /결과\s*보고/,
  /행사\s*결과/,
  /참석자/,
  /명단/,
  /설문/,
  /초청장/,
  /안내\s*문/,
  /사전\s*등록/,
  /partner\s*program/i,
  /파트너\s*정책/
];

function extractExtension(filename: string): string {
  const match = filename.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function extractVersionNumber(filename: string): number | null {
  const patterns = [
    /\bv(\d+(?:\.\d+)?)\b/i,
    /\bver(?:sion)?\s*(\d+(?:\.\d+)?)\b/i,
    /_v(\d+(?:\.\d+)?)(?:\.|_|$)/i,
    /\(v(\d+(?:\.\d+)?)\)/i
  ];
  let max: number | null = null;
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (!match) continue;
    const num = Number(match[1]);
    if (Number.isFinite(num)) max = max == null ? num : Math.max(max, num);
  }
  return max;
}

function extractVersionLabel(filename: string): string | null {
  if (/\bfinal\b/i.test(filename) || /최종/.test(filename)) return "Final";
  if (/공유용|배포용/.test(filename)) return "배포용";
  if (/발표용/.test(filename)) return "발표용";
  const version = extractVersionNumber(filename);
  return version != null ? `v${version}` : null;
}

export function classifyEventDocumentType(filename: string): EventDocumentType {
  const lower = filename.toLowerCase();

  if (/결과\s*보고|행사\s*결과|result\s*report/.test(lower)) return "result_report";
  if (/발표|presentation|배포용|공유용|발표용|\bfinal\b|최종/.test(lower)) return "presentation";
  if (/초청|안내|사전\s*등록|invitation/.test(lower)) return "invitation";
  if (/참석|명단|고객\s*db|설문|attendance|survey/.test(lower)) return "attendance";
  if (/정책|partner\s*program|program/.test(lower)) return "policy";
  if (/quotation|견적|비용|cost|estimate/.test(lower)) return "internal_prep";
  if (/\.(zip|rar|7z|mp4|mov|avi)$/.test(lower)) return "archive";
  if (/사진|단체|photo|\.(jpg|jpeg|png|gif|webp|heic)$/.test(lower)) return "photo";

  return "other";
}

function computeQualityScore(filename: string, documentType: EventDocumentType): number {
  let score = 0;
  const lower = filename.toLowerCase();
  const ext = extractExtension(filename);

  if (/\bfinal\b/i.test(lower) || /최종/.test(lower)) score += 100;
  if (/공유용|배포용/.test(lower)) score += 80;
  if (/발표용/.test(lower)) score += 70;
  if (ext === "pdf") score += 40;
  if (ext === "pptx" || ext === "ppt") score += 25;
  if (documentType === "result_report") score += 60;
  if (documentType === "presentation") score += 50;

  const version = extractVersionNumber(filename);
  if (version != null) score += version * 10;

  if (/작업용|중간본|초안|복사본|임시|draft|wip/i.test(lower)) score -= 80;
  if (/\bv\s*0*[1-3]\b/i.test(lower)) score -= 40;

  return score;
}

function matchRule(
  haystack: string,
  rules: Array<{ pattern: RegExp; reason: string }>
): string | null {
  for (const rule of rules) {
    if (rule.pattern.test(haystack)) return rule.reason;
  }
  return null;
}

export function classifyEventFile(input: EventFileInput): ClassifiedEventFile {
  const originalFilename = input.originalFilename.trim();
  const haystack = `${originalFilename} ${input.sourcePath}`;
  const documentType = classifyEventDocumentType(haystack);
  const versionNumber = extractVersionNumber(haystack);
  const versionLabel = extractVersionLabel(originalFilename);
  const fileExtension = input.fileExtension ?? extractExtension(originalFilename);

  if (isEventFileOversized(input.fileSize)) {
    return {
      ...input,
      originalFilename,
      fileExtension,
      documentType,
      fileStatus: "excluded",
      excludeReason: "파일 용량 초과",
      versionLabel,
      versionNumber,
      displayName: buildEventFileDisplayName(originalFilename, documentType),
      qualityScore: computeQualityScore(originalFilename, documentType),
      visibility: "admin_only"
    };
  }

  if (INTERNAL_PATTERNS.some((p) => p.test(haystack)) || documentType === "internal_prep") {
    return {
      ...input,
      originalFilename,
      fileExtension,
      documentType: "internal_prep",
      fileStatus: "internal",
      excludeReason: "내부 준비자료",
      versionLabel,
      versionNumber,
      displayName: buildEventFileDisplayName(originalFilename, documentType),
      qualityScore: computeQualityScore(originalFilename, documentType),
      visibility: "admin_only"
    };
  }

  const draftReason = matchRule(haystack, DRAFT_PATTERNS);
  if (draftReason) {
    return {
      ...input,
      originalFilename,
      fileExtension,
      documentType,
      fileStatus: "draft",
      excludeReason: draftReason,
      versionLabel,
      versionNumber,
      displayName: buildEventFileDisplayName(originalFilename, documentType),
      qualityScore: computeQualityScore(originalFilename, documentType),
      visibility: "internal_all"
    };
  }

  const oldVersionReason = matchRule(haystack, OLD_VERSION_PATTERNS);
  if (oldVersionReason) {
    return {
      ...input,
      originalFilename,
      fileExtension,
      documentType,
      fileStatus: "old_version",
      excludeReason: oldVersionReason,
      versionLabel,
      versionNumber,
      displayName: buildEventFileDisplayName(originalFilename, documentType),
      qualityScore: computeQualityScore(originalFilename, documentType),
      visibility: "internal_all"
    };
  }

  const duplicateReason = matchRule(haystack, DUPLICATE_PATTERNS);
  if (duplicateReason) {
    return {
      ...input,
      originalFilename,
      fileExtension,
      documentType,
      fileStatus: "duplicate",
      excludeReason: duplicateReason,
      versionLabel,
      versionNumber,
      displayName: buildEventFileDisplayName(originalFilename, documentType),
      qualityScore: computeQualityScore(originalFilename, documentType),
      visibility: "internal_all"
    };
  }

  const excludedReason = matchRule(haystack, EXCLUDED_PATTERNS);
  if (excludedReason || documentType === "archive") {
    return {
      ...input,
      originalFilename,
      fileExtension,
      documentType: documentType === "archive" ? "archive" : documentType,
      fileStatus: "excluded",
      excludeReason: excludedReason ?? "대용량 보관파일",
      versionLabel,
      versionNumber,
      displayName: buildEventFileDisplayName(originalFilename, documentType),
      qualityScore: computeQualityScore(originalFilename, documentType),
      visibility: excludedReason?.includes("영상") || excludedReason?.includes("압축")
        ? "admin_only"
        : "internal_all"
    };
  }

  const isRepresentativeCandidate = REPRESENTATIVE_CANDIDATE_PATTERNS.some((p) => p.test(haystack));

  return {
    ...input,
    originalFilename,
    fileExtension,
    documentType,
    fileStatus: "normal",
    excludeReason: null,
    versionLabel,
    versionNumber,
    displayName: buildEventFileDisplayName(originalFilename, documentType),
    qualityScore: computeQualityScore(originalFilename, documentType) + (isRepresentativeCandidate ? 20 : 0),
    visibility: "internal_all"
  };
}

export function buildEventFileDisplayName(
  originalFilename: string,
  documentType: EventDocumentType
): string {
  const withoutExt = originalFilename.replace(/\.[^.]+$/, "").trim();
  if (withoutExt.length <= 48 && !/^(img_|dsc|photo)/i.test(withoutExt)) {
    return withoutExt;
  }
  return EVENT_DOCUMENT_TYPE_LABEL[documentType] ?? "행사 자료";
}
