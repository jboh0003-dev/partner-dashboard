import { isValidContactEmail } from "@/lib/contacts/email-history";
import { normalizePhoneInput } from "@/lib/contacts/phone-normalize";

export const SWAPPED_FIELDS_REVIEW_REASON = "연락처/이메일 확인 필요";
export const SWAPPED_FIELDS_CORRECTED_NOTE = "연락처/이메일 자동 교정";

function looksLikeEmail(value: string): boolean {
  return isValidContactEmail(value.trim().toLowerCase());
}

function looksLikePhone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("@")) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 13;
}

export type SanitizedContactFields = {
  email: string | null;
  phone: string | null;
  swapped: boolean;
  ambiguous: boolean;
};

/** phone/email 컬럼이 뒤바뀐 경우 자동 교정 */
export function sanitizeContactEmailPhone(input: {
  email?: string | null;
  phone?: string | null;
}): SanitizedContactFields {
  let email = (input.email ?? "").trim();
  let phone = (input.phone ?? "").trim();
  let swapped = false;

  const phoneLooksEmail = Boolean(phone && looksLikeEmail(phone));
  const emailLooksPhone = Boolean(email && looksLikePhone(email) && !looksLikeEmail(email));

  if (phoneLooksEmail && emailLooksPhone) {
    const nextEmail = phone;
    const nextPhone = email;
    email = nextEmail;
    phone = nextPhone;
    swapped = true;
  } else if (phoneLooksEmail && !email) {
    email = phone;
    phone = "";
    swapped = true;
  } else if (emailLooksPhone && !phone) {
    phone = email;
    email = "";
    swapped = true;
  }

  const ambiguous =
    (phoneLooksEmail && Boolean(email) && !emailLooksPhone) ||
    (emailLooksPhone && Boolean(phone) && !phoneLooksEmail);

  return {
    email: email || null,
    phone: phone || null,
    swapped,
    ambiguous
  };
}

/** 저장용: 교정 후 이메일/연락처 정규화 */
export function normalizeSanitizedContactFields(fields: SanitizedContactFields): {
  email: string | null;
  phone: string | null;
  phone_normalized: string | null;
  phone_display: string | null;
  phone_raw: string | null;
} {
  const email = fields.email?.trim().toLowerCase() ?? null;
  const phoneResult = fields.phone ? normalizePhoneInput(fields.phone) : null;

  return {
    email: email && looksLikeEmail(email) ? email : null,
    phone: phoneResult?.display_phone ?? fields.phone,
    phone_raw: phoneResult?.raw_phone ?? fields.phone,
    phone_normalized: phoneResult?.normalized_phone ?? null,
    phone_display: phoneResult?.display_phone ?? fields.phone
  };
}
