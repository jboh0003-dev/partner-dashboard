import type { PartnerContact } from "@/types/partner";
import { inferContactTags, mergeTagLists } from "@/lib/contacts/contact-tags";
import {
  correctPhoneEmailSwap,
} from "@/lib/contacts/phone-email";

export type MergedOrganizationContact = {
  id: string;
  primary_contact_id: string;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  sources: string[];
  alternate_phones: string[];
  alternate_emails: string[];
  member_ids: string[];
  has_multiple_sources: boolean;
  phone_email_swapped: boolean;
  is_contract_contact: boolean;
};

export function normalizePersonName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function contactPriority(contact: PartnerContact): number {
  if (contact.is_contract_contact) return 0;
  if (contact.is_primary) return 1;
  if (contact.role_type === "engineer") return 2;
  if (contact.role_type === "sales") return 3;
  return 10;
}

function mergeGroup(members: PartnerContact[]): MergedOrganizationContact {
  const sorted = [...members].sort((a, b) => contactPriority(a) - contactPriority(b));
  const primary = sorted[0]!;

  const tags = mergeTagLists(...sorted.map((c) => inferContactTags(c)));
  const sources = Array.from(
    new Set(sorted.map((c) => c.source_file?.trim()).filter((v): v is string => Boolean(v)))
  );

  const phones = new Set<string>();
  const emails = new Set<string>();
  let swapped = false;

  for (const member of sorted) {
    const corrected = correctPhoneEmailSwap(member.phone, member.email);
    if (corrected.swapped) swapped = true;
    if (corrected.phone) phones.add(corrected.phone);
    if (corrected.email) emails.add(corrected.email);
  }

  const primaryChannels = correctPhoneEmailSwap(primary.phone, primary.email);
  const phoneList = Array.from(phones);
  const emailList = Array.from(emails);

  const department =
    sorted.find((c) => c.department?.trim())?.department ?? primary.department;
  const position = sorted.find((c) => c.position?.trim())?.position ?? primary.position;

  return {
    id: `merged-${primary.id}`,
    primary_contact_id: primary.id,
    name: primary.name,
    department: department ?? null,
    position: position ?? null,
    phone: primaryChannels.phone ?? phoneList[0] ?? null,
    email: primaryChannels.email ?? emailList[0] ?? null,
    tags,
    sources,
    alternate_phones: phoneList.filter((p) => p !== (primaryChannels.phone ?? phoneList[0])),
    alternate_emails: emailList.filter((e) => e !== (primaryChannels.email ?? emailList[0])),
    member_ids: sorted.map((c) => c.id),
    has_multiple_sources: sorted.length > 1,
    phone_email_swapped: swapped,
    is_contract_contact: sorted.some((c) => c.is_contract_contact)
  };
}

export function mergePartnerOrganizationContacts(
  contacts: PartnerContact[]
): { merged: MergedOrganizationContact[]; raw_count: number } {
  if (contacts.length === 0) {
    return { merged: [], raw_count: 0 };
  }

  const groups = new Map<string, PartnerContact[]>();
  for (const contact of contacts) {
    const key = `${contact.partner_id}|${normalizePersonName(contact.name)}`;
    const list = groups.get(key) ?? [];
    list.push(contact);
    groups.set(key, list);
  }

  const merged = Array.from(groups.values())
    .map(mergeGroup)
    .sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));

  return { merged, raw_count: contacts.length };
}
