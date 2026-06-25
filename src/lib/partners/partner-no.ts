import type { Partner } from "@/types/partner";

export function formatPartnerNo(partner: Pick<Partner, "external_no">): string {
  const value = partner.external_no?.trim();
  return value || "-";
}

export function comparePartnerNo(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const leftNum = Number(left);
  const rightNum = Number(right);
  const leftIsNum = Number.isFinite(leftNum) && /^\d+$/.test(left);
  const rightIsNum = Number.isFinite(rightNum) && /^\d+$/.test(right);

  if (leftIsNum && rightIsNum) return leftNum - rightNum;

  return left.localeCompare(right, "ko-KR", {
    numeric: true,
    sensitivity: "base"
  });
}
