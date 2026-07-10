const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeOptionalText(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateEmail(value: string | null | undefined): {
  valid: boolean;
  warning?: string;
} {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return { valid: true, warning: "이메일이 비어 있습니다." };
  }
  if (!EMAIL_PATTERN.test(normalized)) {
    return { valid: false, warning: "이메일 형식이 올바르지 않습니다." };
  }
  return { valid: true };
}

export function validateContractDate(value: string | null | undefined): {
  valid: boolean;
  message?: string;
} {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return { valid: true };
  if (!DATE_PATTERN.test(normalized)) {
    return { valid: false, message: "계약일자는 YYYY-MM-DD 형식이어야 합니다." };
  }
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, message: "유효하지 않은 계약일자입니다." };
  }
  return { valid: true };
}

export function summarizeContractContactWarnings(
  contacts: Array<{ is_contract_contact?: boolean | null }>
): string[] {
  const count = contacts.filter((contact) => contact.is_contract_contact).length;
  if (count === 0) return ["계약담당자 미지정"];
  if (count > 1) return ["계약담당자 복수 지정"];
  return [];
}

export function serializeFieldValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
