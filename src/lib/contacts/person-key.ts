import { normalizeCompanyName } from "@/lib/partner-match";

export function normalizePersonName(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, "").toLowerCase();
}

export function buildPersonKey(partnerId: string, name: string): string {
  return `${partnerId}|${normalizePersonName(name)}`;
}

export function buildCompanyPersonKey(companyName: string, name: string): string {
  const company = normalizeCompanyName(companyName) ?? companyName.trim().toLowerCase();
  return `${company}|${normalizePersonName(name)}`;
}

export function isCanonicalContact(contact: {
  merged_into_contact_id?: string | null;
  deleted_at?: string | null;
}): boolean {
  return !contact.merged_into_contact_id && !contact.deleted_at;
}
