export function normalizePhoneDigits(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value.replace(/\D/g, "");
}

export function phonesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right) return false;
  return left === right;
}
