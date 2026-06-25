
const GENERIC_FOLDER_PATTERNS: RegExp[] = [
  /^20\d{2}\s*년\s*\d{1,2}\s*월\s*(신청서|계약서|자료|문서)$/i,
  /^20\d{2}\s*년\s*(신청서|계약서|자료|문서)$/i,
  /^기존\s*플래티넘\s*교육\s*참여$/i,
  /^기존플래티넘\s*교육참여$/i,
  /^교육\s*참여$/i,
  /^교육참여$/i,
  /^신청서$/i,
  /^계약서$/i,
  /^자료$/i,
  /^문서$/i,
  /^파트너\s*신청서$/i,
  /^파트너\s*계약서$/i,
  /^플래티넘\s*파트너$/i
];

export type FolderPartnerHint = {
  source_folder_name: string;
  normalized_name: string | null;
  primary: string | null;
  aliases: string[];
  match_candidates: string[];
  is_generic_folder: boolean;
};

/** relative path에서 직계 상위 폴더명 추출 (예: 113.휴버텍/파일.pdf → 113.휴버텍) */
export function getSourceFolderName(relativePath: string): string | null {
  if (!relativePath.includes("/")) return null;
  const parts = relativePath.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 2] ?? null;
}

/** 파트ner명이 아닌 월별/공통 폴더 여부 */
export function isGenericFolderName(folderName: string | null | undefined): boolean {
  const raw = folderName?.trim();
  if (!raw) return false;

  for (const pattern of GENERIC_FOLDER_PATTERNS) {
    if (pattern.test(raw)) return true;
  }

  if (/^\d{1,2}\s*월\s*(신청서|계약서|자료|문서)?$/i.test(raw)) return true;
  if (/^20\d{2}\s*년?\s*\d{1,2}\s*월/i.test(raw) && /신청서|계약서|교육|자료|문서/i.test(raw)) {
    return true;
  }

  const normalized = normalizeFolderPartnerName(raw);
  if (!normalized) return true;
  if (/^(신청서|계약서|자료|문서|교육참여|교육\s*참여)$/i.test(normalized)) return true;

  return false;
}

/** 폴더명에서 접수번호/날짜/순번 prefix를 제거한 파트너명 후보 */
export function normalizeFolderPartnerName(folderName: string | null | undefined): string | null {
  let text = folderName?.trim() ?? "";
  if (!text) return null;

  text = text
    .replace(/^\[?\s*접수[_\s-]*\d+\s*\]?\s*/i, "")
    .replace(/^\[접수[_\s-]*\d+\]\s*/i, "")
    .replace(/^\d{6,8}_/i, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\[보류\]/gi, "")
    .replace(/\(보류\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || null;
}

/** 폴더명에서 파트너 매칭 후보 추출 */
export function parseFolderPartnerHint(folderName: string | null | undefined): FolderPartnerHint | null {
  const raw = folderName?.trim();
  if (!raw) return null;

  if (isGenericFolderName(raw)) {
    return {
      source_folder_name: raw,
      normalized_name: null,
      primary: null,
      aliases: [],
      match_candidates: [],
      is_generic_folder: true
    };
  }

  const normalized = normalizeFolderPartnerName(raw);
  if (!normalized) {
    return {
      source_folder_name: raw,
      normalized_name: null,
      primary: null,
      aliases: [],
      match_candidates: [],
      is_generic_folder: true
    };
  }

  const aliases: string[] = [];
  let primary = normalized;

  const parenMatch = primary.match(/^(.+?)\(([^)]+)\)\s*$/);
  if (parenMatch) {
    primary = parenMatch[1]!.trim();
    for (const part of parenMatch[2]!.split(/[,/|·]/)) {
      const alias = part.trim();
      if (alias.length >= 2) aliases.push(alias);
    }
  }

  primary = primary.replace(/플래티넘\s*파트너/gi, "").replace(/\s+/g, " ").trim();
  if (!primary) {
    return {
      source_folder_name: raw,
      normalized_name: normalized,
      primary: null,
      aliases: [],
      match_candidates: [],
      is_generic_folder: true
    };
  }

  const match_candidates = Array.from(
    new Set([primary, ...aliases].map((value) => value.trim()).filter((value) => value.length >= 2))
  );

  return {
    source_folder_name: raw,
    normalized_name: primary,
    primary,
    aliases,
    match_candidates,
    is_generic_folder: false
  };
}

export function extractFolderPartnerHintFromPath(
  relativePath: string,
  sourceFolder = ""
): FolderPartnerHint | null {
  const folderName =
    getSourceFolderName(relativePath) ??
    sourceFolder
      .split("/")
      .filter(Boolean)
      .pop() ??
    null;

  return parseFolderPartnerHint(folderName);
}
