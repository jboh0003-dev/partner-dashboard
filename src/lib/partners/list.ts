import { PARTNER_GRADE_LABEL } from "@/lib/constants";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import { formatDate } from "@/lib/utils";
import type { Partner, PartnerContact } from "@/types/partner";

export type PartnerListRow = {
  partner: Partner;
  contactName: string | null;
  contactPosition: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};

export function resolvePartnerContact(
  contacts: PartnerContact[]
): PartnerContact | null {
  if (contacts.length === 0) return null;
  const contractContact = contacts.find((contact) => contact.is_contract_contact);
  if (contractContact) return contractContact;
  const primaryContact = contacts.find((contact) => contact.is_primary);
  if (primaryContact) return primaryContact;
  return contacts[0] ?? null;
}

export function buildPartnerListRows(
  partners: Partner[],
  contacts: PartnerContact[]
): PartnerListRow[] {
  const contactsByPartner = new Map<string, PartnerContact[]>();
  for (const contact of contacts) {
    const list = contactsByPartner.get(contact.partner_id) ?? [];
    list.push(contact);
    contactsByPartner.set(contact.partner_id, list);
  }

  return partners.map((partner) => {
    const partnerContacts = contactsByPartner.get(partner.id) ?? [];
    const contact = resolvePartnerContact(partnerContacts);
    return {
      partner,
      contactName: contact?.name ?? null,
      contactPosition: contact?.position ?? null,
      contactPhone: contact?.phone ?? null,
      contactEmail: contact?.email ?? null
    };
  });
}

export function filterPartnerListRows(
  rows: PartnerListRow[],
  query: string | undefined
): PartnerListRow[] {
  const q = query?.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => {
    const haystack = [
      row.partner.company_name,
      row.contactName,
      row.contactPhone,
      row.contactEmail
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function partnerListRowsToCsv(rows: PartnerListRow[]) {
  return rows.map((row) => ({
    번호: formatPartnerNo(row.partner) === "-" ? "" : formatPartnerNo(row.partner),
    회사명: row.partner.company_name,
    등급:
      PARTNER_GRADE_LABEL[row.partner.grade ?? "none"] ??
      row.partner.grade ??
      "",
    계약일자: row.partner.contract_start_date
      ? formatDate(row.partner.contract_start_date)
      : "",
    담당자명: row.contactName ?? "",
    직급: row.contactPosition ?? "",
    연락처: row.contactPhone ?? "",
    이메일: row.contactEmail ?? ""
  }));
}
