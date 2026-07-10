export type PhoneNormalizationResult = {
  raw_phone: string;
  normalized_phone: string;
  display_phone: string;
  needs_review: boolean;
};

/** 숫자가 아닌 문자 제거 */
export function stripPhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** 엑셀 숫자형 등으로 앞자리 0이 빠진 휴대폰 보정 */
export function fixMissingLeadingZero(digits: string): string {
  if (digits.length === 10 && digits.startsWith("10")) {
    return `0${digits}`;
  }
  return digits;
}

/** 화면 표시용 하이픈 포맷 — 규칙에 맞지 않으면 null */
export function formatDisplayPhone(digits: string): string | null {
  if (/^010\d{8}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (/^02\d{8}$/.test(digits)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (/^02\d{7}$/.test(digits)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  if (/^0[3-6][1-9]\d{7}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (/^0[3-6][1-9]\d{8}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  return null;
}

export function normalizePhoneInput(value: string | null | undefined): PhoneNormalizationResult | null {
  if (value == null) return null;

  const raw_phone = String(value).trim();
  if (!raw_phone) return null;

  let digits = stripPhoneDigits(raw_phone);
  if (!digits) return null;

  digits = fixMissingLeadingZero(digits);

  const formatted = formatDisplayPhone(digits);
  if (formatted) {
    return {
      raw_phone,
      normalized_phone: digits,
      display_phone: formatted,
      needs_review: false
    };
  }

  return {
    raw_phone,
    normalized_phone: digits,
    display_phone: raw_phone,
    needs_review: true
  };
}

/** 엑셀 셀(raw) → 표시용 연락처 문자열 */
export function parsePhoneFromCell(value: unknown): string | null {
  if (value == null) return null;

  let raw: string;
  if (typeof value === "number" && Number.isFinite(value)) {
    raw = String(Math.trunc(value));
  } else {
    raw = String(value).trim();
  }

  if (!raw) return null;
  const result = normalizePhoneInput(raw);
  return result?.display_phone ?? raw;
}

export function resolvePhoneDisplay(input: {
  phone?: string | null;
  display_phone?: string | null;
  raw_phone?: string | null;
}): string | null {
  if (input.display_phone?.trim()) return input.display_phone.trim();

  const fromRaw = normalizePhoneInput(input.raw_phone ?? input.phone);
  if (fromRaw) return fromRaw.display_phone;

  const trimmed = input.phone?.trim();
  return trimmed || null;
}

export const PHONE_REVIEW_REASON = "연락처 형식 확인 필요";
