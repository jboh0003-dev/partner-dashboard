import { normalizeGrade as normalizeGradeToken } from "@/lib/excel/parse-partner-contracts";
import { PARTNER_GRADE_LABEL, PARTNER_GRADE_ORDER } from "@/lib/constants";

export const GRADE_ORIGINAL_COLUMN_KEYS = ["등급"] as const;

export const GRADE_CHANGE_COLUMN_KEYS = [
  "등급(변경)",
  "등급 (변경)",
  "등급 변경",
  "등급변경",
  "등급 원문"
] as const;

const GRADE_TOKENS = new Set<string>(PARTNER_GRADE_ORDER);

export type ResolvedPartnerGrade = {
  grade_original: string | null;
  grade_change_raw: string | null;
  grade: string | null;
  grade_effective_raw: string | null;
};

export type PartnerGradeSource = {
  company_name?: string;
  grade_override?: string | null;
  grade_change_raw?: string | null;
  grade_raw?: string | null;
  grade?: string | null;
  grade_original?: string | null;
};

/** 괄호 앞 등급명만 추출 — 예: 플래티넘(골드 변경예정) → 플래티넘 */
export function extractGradeLabelForNormalization(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = trimmed.match(/^([^()（）[\]]+)/);
  return (match?.[1] ?? trimmed).trim();
}

/** 원문/토큰을 DB 등급 토큰(platinum, service_partner 등)으로 정규화 */
export function normalizePartnerGrade(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const trimmed = input.trim();
  if (GRADE_TOKENS.has(trimmed)) return trimmed;

  const label = extractGradeLabelForNormalization(trimmed);
  if (!label) return null;
  const normalized = normalizeGradeToken(label);
  return normalized === "none" ? null : normalized;
}

function resolveGradeToken(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return normalizePartnerGrade(raw);
}

/**
 * 화면 표시·집계·필터용 최종 적용 등급.
 * 우선순위: grade_override → grade_change_raw → grade → grade_original
 */
export function getDisplayPartnerGrade(partner: PartnerGradeSource): string {
  const override = resolveGradeToken(partner.grade_override);
  if (override) return override;

  const fromChange = resolveGradeToken(partner.grade_change_raw);
  if (fromChange) return fromChange;

  const fromGrade = resolveGradeToken(partner.grade);
  if (fromGrade) return fromGrade;

  const fromOriginal = resolveGradeToken(partner.grade_original);
  if (fromOriginal) return fromOriginal;

  return "none";
}

export function getDisplayPartnerGradeLabel(partner: PartnerGradeSource): string {
  const token = getDisplayPartnerGrade(partner);
  return PARTNER_GRADE_LABEL[token] ?? token;
}

/** @deprecated getDisplayPartnerGrade 사용 */
export const resolveEffectivePartnerGrade = getDisplayPartnerGrade;

/** @deprecated getDisplayPartnerGradeLabel 사용 */
export const getEffectivePartnerGradeLabel = getDisplayPartnerGradeLabel;

export function resolvePartnerGradeFromExcel(
  gradeOriginal: string | null | undefined,
  gradeChangeRaw: string | null | undefined
): ResolvedPartnerGrade {
  const original = gradeOriginal?.trim() || null;
  const changeRaw = gradeChangeRaw?.trim() || null;
  const effectiveRaw = changeRaw || original;
  const grade = effectiveRaw ? normalizePartnerGrade(effectiveRaw) : null;

  return {
    grade_original: original,
    grade_change_raw: changeRaw,
    grade,
    grade_effective_raw: effectiveRaw
  };
}

export function pickGradeColumnsFromRow(
  row: Record<string, unknown>,
  pickString: (row: Record<string, unknown>, keys: readonly string[]) => string
): ResolvedPartnerGrade {
  const gradeOriginal = pickString(row, [...GRADE_ORIGINAL_COLUMN_KEYS]) || null;
  const gradeChangeRaw = pickString(row, [...GRADE_CHANGE_COLUMN_KEYS]) || null;
  return resolvePartnerGradeFromExcel(gradeOriginal, gradeChangeRaw);
}

/** URL query grade → DB 토큰 (Platinum, Service Partner 등 표시명 지원) */
export function parseGradeQueryParam(value: string | undefined): string | null {
  if (!value || value === "all") return null;
  const normalized = decodeURIComponent(value).trim().toLowerCase();
  const map: Record<string, string> = {
    platinum: "platinum",
    gold: "gold",
    silver: "silver",
    "service partner": "service_partner",
    service_partner: "service_partner",
    servicepartner: "service_partner",
    서비스파트너: "service_partner",
    "서비스 파트너": "service_partner",
    서비스: "service_partner",
    strategic: "strategic",
    none: "none",
    미분류: "none"
  };
  const mapped = map[normalized];
  if (mapped) return mapped;
  return normalizePartnerGrade(value) ?? normalized.replace(/\s+/g, "_");
}

/** 수정 모달 저장용 — 선택 등급을 override + grade에 반영 */
export function buildPartnerGradeSavePayload(gradeToken: string | null | undefined): {
  grade: string | null;
  grade_override: string | null;
} {
  const token = gradeToken?.trim();
  if (!token || token === "none") {
    return { grade: null, grade_override: null };
  }
  return {
    grade: token,
    grade_override: token
  };
}
