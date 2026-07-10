const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeContactEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isValidContactEmail(value: string | null | undefined): boolean {
  const normalized = normalizeContactEmail(value);
  if (!normalized) return false;
  return EMAIL_PATTERN.test(normalized);
}

export function appendPreviousEmail(
  currentPrevious: string[] | null | undefined,
  oldEmail: string | null | undefined
): string[] {
  const normalized = normalizeContactEmail(oldEmail);
  if (!normalized || !isValidContactEmail(normalized)) {
    return dedupeEmails(currentPrevious ?? []);
  }
  return dedupeEmails([...(currentPrevious ?? []), normalized]);
}

export function dedupeEmails(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeContactEmail(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function contactHasPreviousEmail(
  previousEmails: string[] | null | undefined,
  email: string | null | undefined
): boolean {
  const normalized = normalizeContactEmail(email);
  if (!normalized) return false;
  return (previousEmails ?? []).some((item) => normalizeContactEmail(item) === normalized);
}

/** 메일 발송 대상: active + 유효 이메일 */
export function isMailEligibleContact(input: {
  is_active?: boolean | null;
  deleted_at?: string | null;
  email?: string | null;
}): boolean {
  if (input.is_active === false || input.deleted_at) return false;
  return isValidContactEmail(input.email);
}
