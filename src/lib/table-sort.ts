import { PARTNER_GRADE_ORDER } from "@/lib/constants";
import { comparePartnerNo } from "@/lib/partners/partner-no";

export type SortDir = "asc" | "desc";
export type SortKind = "text" | "date" | "number" | "grade" | "partner_no";

const GRADE_RANK = new Map<string, number>(
  PARTNER_GRADE_ORDER.map((grade, index) => [grade, index])
);

export function compareText(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right, "ko-KR", {
    numeric: true,
    sensitivity: "base"
  });
}

export function compareDate(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

export function compareNumber(
  a: number | null | undefined,
  b: number | null | undefined
): number {
  const left = a ?? null;
  const right = b ?? null;
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

export function compareGrade(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const leftRank = GRADE_RANK.get(a ?? "none") ?? GRADE_RANK.size;
  const rightRank = GRADE_RANK.get(b ?? "none") ?? GRADE_RANK.size;
  return leftRank - rightRank;
}

export function compareByKind(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  kind: SortKind
): number {
  switch (kind) {
    case "partner_no":
      return comparePartnerNo(
        typeof a === "number" ? String(a) : (a as string | null | undefined),
        typeof b === "number" ? String(b) : (b as string | null | undefined)
      );
    case "date":
      return compareDate(
        typeof a === "number" ? String(a) : (a as string | null | undefined),
        typeof b === "number" ? String(b) : (b as string | null | undefined)
      );
    case "number":
      return compareNumber(
        typeof a === "number" ? a : a == null || a === "" ? null : Number(a),
        typeof b === "number" ? b : b == null || b === "" ? null : Number(b)
      );
    case "grade":
      return compareGrade(
        typeof a === "number" ? String(a) : (a as string | null | undefined),
        typeof b === "number" ? String(b) : (b as string | null | undefined)
      );
    case "text":
    default:
      return compareText(
        typeof a === "number" ? String(a) : (a as string | null | undefined),
        typeof b === "number" ? String(b) : (b as string | null | undefined)
      );
  }
}

export function sortRows<T>(
  rows: T[],
  getValue: (row: T) => string | number | null | undefined,
  kind: SortKind,
  dir: SortDir
): T[] {
  const direction = dir === "desc" ? -1 : 1;
  return [...rows].sort(
    (a, b) => compareByKind(getValue(a), getValue(b), kind) * direction
  );
}
