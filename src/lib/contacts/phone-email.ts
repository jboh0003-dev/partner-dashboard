export type CorrectedContactChannels = {
  phone: string | null;
  email: string | null;
  swapped: boolean;
};

function looksLikeEmail(value: string): boolean {
  return /@/.test(value.trim());
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && /^[\d\-+().\s]+$/.test(value.trim());
}

/** 화면 표시용: 연락처/이메일 칸이 뒤바뀐 경우 swap */
export function correctPhoneEmailSwap(
  phone: string | null | undefined,
  email: string | null | undefined
): CorrectedContactChannels {
  const rawPhone = phone?.trim() || null;
  const rawEmail = email?.trim() || null;

  if (!rawPhone && !rawEmail) {
    return { phone: null, email: null, swapped: false };
  }

  const phoneIsEmail = rawPhone ? looksLikeEmail(rawPhone) : false;
  const emailIsPhone = rawEmail ? looksLikePhone(rawEmail) && !looksLikeEmail(rawEmail) : false;

  if (phoneIsEmail && emailIsPhone) {
    return { phone: rawEmail, email: rawPhone, swapped: true };
  }
  if (phoneIsEmail && !rawEmail) {
    return { phone: null, email: rawPhone, swapped: true };
  }
  if (emailIsPhone && !rawPhone) {
    return { phone: rawEmail, email: null, swapped: true };
  }

  return { phone: rawPhone, email: rawEmail, swapped: false };
}

export function normalizeEmailKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizePhoneKey(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}
