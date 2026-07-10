import {
  getDisplayPartnerGrade,
  getDisplayPartnerGradeLabel
} from "@/lib/partners/grade";
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
  const active = contacts.filter(
    (contact) => contact.is_active !== false && !contact.deleted_at
  );
  if (active.length === 0) return null;
  const contractContact = active.find((contact) => contact.is_contract_contact);
  if (contractContact) return contractContact;
  const primaryContact = active.find((contact) => contact.is_primary);
  if (primaryContact) return primaryContact;
  return active[0] ?? null;
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
  query: string | undefined,
  contacts: PartnerContact[] = []
): PartnerListRow[] {
  const q = query?.trim().toLowerCase();
  if (!q) return rows;

  const contactsByPartner = new Map<string, PartnerContact[]>();
  for (const contact of contacts) {
    if (contact.is_active === false || contact.deleted_at) continue;
    const list = contactsByPartner.get(contact.partner_id) ?? [];
    list.push(contact);
    contactsByPartner.set(contact.partner_id, list);
  }

  return rows.filter((row) => {
    const partnerContacts = contactsByPartner.get(row.partner.id) ?? [];
    const allContactHaystack = partnerContacts
      .flatMap((contact) => [contact.name, contact.email, contact.phone, contact.department, contact.position])
      .filter(Boolean)
      .join(" ");

    const haystack = [
      row.partner.company_name,
      row.partner.external_no,
      formatPartnerNo(row.partner),
      getDisplayPartnerGrade(row.partner),
      getDisplayPartnerGradeLabel(row.partner),
      row.partner.sales_owner,
      row.partner.contract_contact_name,
      row.partner.contract_contact_email,
      row.partner.contract_contact_phone,
      row.contactName,
      row.contactPhone,
      row.contactEmail,
      allContactHaystack
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
    등급: getDisplayPartnerGradeLabel(row.partner),
    계약일자: row.partner.contract_start_date
      ? formatDate(row.partner.contract_start_date)
      : "",
    담당자명: row.contactName ?? "",
    직급: row.contactPosition ?? "",
    연락처: row.contactPhone ?? "",
    이메일: row.contactEmail ?? ""
  }));
}
