import { normalizeBusinessNumber } from "@/lib/partner-match";
import type {
  MissingField,
  PartnerApplicationFormPayload
} from "@/lib/partner-applications/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGITS_RE = /^\d{9,11}$/;

export function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function formatBusinessNumberInput(value: string): string {
  const d = digitsOnly(value).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export function formatPhoneInput(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.startsWith("02")) {
    if (d.length <= 2) return d;
    if (d.length <= 6) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return `${d.slice(0, 2)}-${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  const d = digitsOnly(value);
  return PHONE_DIGITS_RE.test(d);
}

export function isValidBusinessNumber(value: string): boolean {
  const d = digitsOnly(value);
  return d.length === 10;
}

function filled(value: string | null | undefined): boolean {
  return Boolean(String(value ?? "").trim());
}

/** Validate only fields that the public wizard marks as required (*). */
export function collectMissingFields(
  form: PartnerApplicationFormPayload,
  options?: { hasBusinessRegistrationDoc?: boolean }
): MissingField[] {
  const missing: MissingField[] = [];
  const push = (section: string, field: string, label: string) => {
    missing.push({ section, field, label });
  };

  const c = form.company;
  if (!filled(c.company_name)) push("company", "company_name", "기업명");
  if (!isValidBusinessNumber(c.business_registration_number)) {
    push("company", "business_registration_number", "사업자등록번호");
  }
  if (!filled(c.representative_name)) push("company", "representative_name", "대표자명");
  if (!filled(c.established_date)) push("company", "established_date", "설립일자");
  if (!filled(c.address)) push("company", "address", "주소");
  if (!filled(c.total_employees)) push("company", "total_employees", "전체 임직원 수");
  if (!filled(c.total_engineers)) push("company", "total_engineers", "전체 엔지니어 수");
  if (!filled(c.dedicated_sales_count)) {
    push("company", "dedicated_sales_count", "오케스트로 전담 영업인원 수");
  }

  const ct = form.contact;
  if (!filled(ct.name)) push("contact", "name", "담당자 성명");
  if (!filled(ct.position)) push("contact", "position", "담당자 직급/직책");
  if (!filled(ct.department)) push("contact", "department", "담당자 부서");
  if (!isValidPhone(ct.phone)) push("contact", "phone", "담당자 휴대폰");
  if (!isValidEmail(ct.email)) push("contact", "email", "담당자 이메일");

  const ceo = form.people.ceo.find((p) => filled(p.name));
  if (!ceo) push("people", "ceo", "대표이사 정보");

  const sales = form.people.sales.filter((p) => filled(p.name));
  if (sales.length < 1) push("people", "sales", "영업 전담인원 (최소 1명)");

  const customers = form.customers.filter((row) => filled(row.customer_name));
  if (customers.length < 1) {
    push("customers", "min", "주요고객 및 영업계획 (최소 1건, 고객명)");
  }

  if (options?.hasBusinessRegistrationDoc === false) {
    push("documents", "business_registration", "사업자등록증");
  }

  return missing;
}

export function normalizeFormForStorage(
  form: PartnerApplicationFormPayload
): PartnerApplicationFormPayload {
  return {
    ...form,
    company: {
      ...form.company,
      business_registration_number: formatBusinessNumberInput(
        form.company.business_registration_number
      ),
      company_name: form.company.company_name.trim()
    },
    contact: {
      ...form.contact,
      phone: formatPhoneInput(form.contact.phone),
      email: form.contact.email.trim().toLowerCase(),
      office_phone: form.contact.office_phone
        ? formatPhoneInput(form.contact.office_phone)
        : ""
    },
    flags: {
      technical_collaboration_requested: false,
      platinum_review_requested: false
    },
    applicant: {
      name: form.applicant.name.trim(),
      email: form.applicant.email.trim().toLowerCase()
    }
  };
}

export function businessNumberNormalized(value: string): string {
  return normalizeBusinessNumber(value) ?? digitsOnly(value);
}
