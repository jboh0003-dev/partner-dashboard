import {
  CONTACT_ASSIGNMENT_TONE_CLASS,
  type ContactAssignmentTone
} from "@/lib/contacts/display";

const HIDDEN_ROLE_LABELS = new Set([
  "",
  "-",
  "null",
  "undefined",
  "미분류",
  "일반담당자",
  "일반 담당자",
  "일반담당",
  "일반 담당",
  "etc"
]);

/** 화면 배지에서 숨길 담당구분 (데이터는 유지) */
export function isHiddenRoleLabel(label: string | null | undefined): boolean {
  const trimmed = (label ?? "").trim();
  if (!trimmed) return true;
  const normalized = trimmed.replace(/\s+/g, "").toLowerCase();
  if (HIDDEN_ROLE_LABELS.has(trimmed) || HIDDEN_ROLE_LABELS.has(normalized)) return true;
  if (normalized === "일반담당자") return true;
  return false;
}

/** 교육/행사 참석 태그 — 담당구분 배지 대신 이력에서 보여줄 값 */
export function isEducationEventRoleLabel(label: string): boolean {
  const normalized = label.replace(/\s+/g, "");
  return (
    normalized.includes("정기교육참석") ||
    normalized.includes("기술파트너교육") ||
    normalized.includes("교육참석") ||
    normalized.includes("행사참석")
  );
}

function normalizeRoleKey(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

/** 중복 제거 + 숨김/교육 태그 제외한 화면용 역할 목록 */
export function collectDisplayRoleLabels(labels: Iterable<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of labels) {
    const label = normalizeRoleKey(raw);
    if (isHiddenRoleLabel(label) || isEducationEventRoleLabel(label)) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
  }

  return result;
}

export type RoleLabelTone = ContactAssignmentTone | "tech";

export function getRoleLabelTone(label: string): RoleLabelTone {
  const normalized = label.replace(/\s+/g, "").toLowerCase();

  if (normalized.includes("계약담당")) return "contract";
  if (normalized.includes("영업")) return "sales";
  if (normalized.includes("엔지니어")) return "engineer";
  if (normalized.includes("대표") || normalized.includes("경영")) return "executive";
  if (normalized.includes("관리")) return "admin";
  if (normalized.includes("기술")) return "tech";

  return "default";
}

export const ROLE_LABEL_TONE_CLASS: Record<RoleLabelTone, string> = {
  ...CONTACT_ASSIGNMENT_TONE_CLASS,
  tech: "bg-indigo-50 text-indigo-800 ring-indigo-100"
};

export function roleLabelBadgeClass(label: string): string {
  const tone = getRoleLabelTone(label);
  return `inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${ROLE_LABEL_TONE_CLASS[tone]}`;
}
