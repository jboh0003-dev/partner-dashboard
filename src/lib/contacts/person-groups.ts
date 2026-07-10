import { buildPersonKey, normalizePersonName } from "@/lib/contacts/person-key";
import { collectDisplayRoleLabels } from "@/lib/contacts/role-labels";
import {
  isBaselineExcludedContact,
  isEducationOrEventOnlyContact
} from "@/lib/contacts/contact-views";
import {
  normalizePhoneInput,
  resolvePhoneDisplay
} from "@/lib/contacts/phone-normalize";
import type { ContactDetailBundle, ContactPhoneRow } from "@/lib/contacts/contact-details";
import { isEmailSendable } from "@/lib/contacts/email-deliverability";
import type { ContactTableRow } from "@/components/contacts/contacts-table";

export type PersonPhoneEntry = {
  display: string;
  normalized: string;
  needs_review: boolean;
};

export type PersonEmailEntry = {
  email: string;
  is_primary: boolean;
  is_bounced: boolean;
  is_sendable: boolean;
};

export type PersonContactRow = ContactTableRow & {
  person_key: string;
  member_ids: string[];
  extra_email_count: number;
  extra_phone_count: number;
  role_labels: string[];
  display_role_labels: string[];
  all_emails: string[];
  all_email_entries: PersonEmailEntry[];
  all_phones: PersonPhoneEntry[];
  display_phone: string | null;
  phone_needs_review: boolean;
  has_bounced_email: boolean;
  has_unsendable_email: boolean;
  is_merge_candidate: boolean;
  is_baseline_excluded?: boolean;
  is_history_only?: boolean;
  review_required?: boolean;
  review_reason?: string | null;
};

type RawContact = {
  id: string;
  partner_id: string;
  partner_no: string | null;
  name: string;
  company_name: string;
  contract_start_date?: string | null;
  role_type: string | null;
  role_raw?: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  phone_display?: string | null;
  phone_normalized?: string | null;
  phone_raw?: string | null;
  email: string | null;
  memo?: string | null;
  created_at?: string;
  is_contract_contact: boolean;
  is_primary?: boolean;
  review_required?: boolean;
  review_reason?: string | null;
  merge_keep_separate?: boolean | null;
  in_current_full_db?: boolean | null;
  is_active?: boolean | null;
  source_file?: string | null;
};

function addPhoneEntry(
  map: Map<string, PersonPhoneEntry>,
  input: {
    phone?: string | null;
    raw_phone?: string | null;
    display_phone?: string | null;
    normalized_phone?: string | null;
    needs_review?: boolean;
  }
) {
  const normalized = normalizePhoneInput(
    input.raw_phone ?? input.phone ?? input.display_phone ?? ""
  );
  const normalizedKey =
    input.normalized_phone?.trim() ||
    normalized?.normalized_phone ||
    normalizePhoneInput(input.phone)?.normalized_phone;
  if (!normalizedKey) return;

  const display =
    input.display_phone?.trim() ||
    resolvePhoneDisplay(input) ||
    normalized?.display_phone ||
    input.phone?.trim() ||
    "";
  if (!display) return;

  const needsReview = input.needs_review ?? normalized?.needs_review ?? false;
  const existing = map.get(normalizedKey);
  if (!existing || (needsReview === false && existing.needs_review)) {
    map.set(normalizedKey, {
      display,
      normalized: normalizedKey,
      needs_review: needsReview
    });
  }
}

function addPhoneRow(map: Map<string, PersonPhoneEntry>, row: ContactPhoneRow) {
  addPhoneEntry(map, {
    phone: row.phone,
    raw_phone: row.raw_phone,
    display_phone: row.display_phone,
    normalized_phone: row.normalized_phone,
    needs_review: row.needs_review
  });
}

export function groupContactsByPerson(
  contacts: RawContact[],
  detailsByContactId: Map<string, ContactDetailBundle>
): PersonContactRow[] {
  const groups = new Map<string, RawContact[]>();

  for (const contact of contacts) {
    const baseKey = buildPersonKey(contact.partner_id, contact.name);
    const key = contact.merge_keep_separate ? `${baseKey}|${contact.id}` : baseKey;
    const list = groups.get(key) ?? [];
    list.push(contact);
    groups.set(key, list);
  }

  const rows: PersonContactRow[] = [];

  for (const [, members] of groups) {
    const sorted = [...members].sort((a, b) => {
      if (a.is_contract_contact !== b.is_contract_contact) return a.is_contract_contact ? -1 : 1;
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });
    const primary = sorted[0]!;

    const allEmails = new Set<string>();
    const emailEntries = new Map<string, PersonEmailEntry>();
    const phoneMap = new Map<string, PersonPhoneEntry>();
    const allRoles = new Set<string>();
    let hasBouncedEmail = false;
    let hasUnsendableEmail = false;

    function addEmailEntry(email: string, flags?: Partial<PersonEmailEntry>) {
      const normalized = email.trim().toLowerCase();
      if (!normalized) return;
      allEmails.add(normalized);
      const existing = emailEntries.get(normalized);
      const entry: PersonEmailEntry = {
        email: normalized,
        is_primary: flags?.is_primary ?? existing?.is_primary ?? false,
        is_bounced: flags?.is_bounced ?? existing?.is_bounced ?? false,
        is_sendable: flags?.is_sendable ?? existing?.is_sendable ?? true
      };
      emailEntries.set(normalized, entry);
      if (entry.is_bounced) hasBouncedEmail = true;
      if (!isEmailSendable(entry)) hasUnsendableEmail = true;
    }

    for (const member of sorted) {
      if (member.email?.trim()) {
        addEmailEntry(member.email, { is_primary: true });
      }
      addPhoneEntry(phoneMap, {
        phone: member.phone,
        raw_phone: member.phone_raw,
        display_phone: member.phone_display,
        normalized_phone: member.phone_normalized
      });

      const bundle = detailsByContactId.get(member.id);
      for (const row of bundle?.emails ?? []) {
        addEmailEntry(row.email, {
          is_primary: row.is_primary,
          is_bounced: row.is_bounced,
          is_sendable: row.is_sendable
        });
      }
      for (const row of bundle?.phones ?? []) addPhoneRow(phoneMap, row);
      for (const row of bundle?.roles ?? []) allRoles.add(row.role_name);
      if (member.is_contract_contact) allRoles.add("계약담당자");
      if (member.role_raw?.trim()) allRoles.add(member.role_raw.trim());
    }

    const emailList = Array.from(allEmails);
    const emailEntryList = Array.from(emailEntries.values());
    const phoneList = Array.from(phoneMap.values());
    const roleList = Array.from(allRoles);
    const displayRoleList = collectDisplayRoleLabels(roleList);

    const primaryDisplayPhone =
      resolvePhoneDisplay({
        phone: primary.phone,
        raw_phone: primary.phone_raw,
        display_phone: primary.phone_display
      }) ??
      phoneList.find((entry) => !entry.needs_review)?.display ??
      phoneList[0]?.display ??
      null;

    rows.push({
      id: primary.id,
      partner_id: primary.partner_id,
      partner_no: primary.partner_no,
      name: primary.name,
      company_name: primary.company_name,
      contract_start_date: primary.contract_start_date,
      role_type: primary.role_type,
      role_raw: primary.role_raw,
      department: primary.department,
      position: primary.position,
      phone: primaryDisplayPhone,
      email: primary.email ?? emailList[0] ?? null,
      memo: primary.memo,
      created_at: primary.created_at,
      is_contract_contact: sorted.some((m) => m.is_contract_contact),
      person_key: buildPersonKey(primary.partner_id, primary.name),
      member_ids: sorted.map((m) => m.id),
      extra_email_count: Math.max(0, emailList.length - 1),
      extra_phone_count: Math.max(0, phoneList.length - 1),
      role_labels: roleList,
      display_role_labels: displayRoleList,
      all_emails: emailList,
      all_email_entries: emailEntryList,
      all_phones: phoneList,
      display_phone: primaryDisplayPhone,
      phone_needs_review: phoneList.some((entry) => entry.needs_review),
      has_bounced_email: hasBouncedEmail,
      has_unsendable_email: hasUnsendableEmail,
      is_merge_candidate: sorted.length > 1,
      is_baseline_excluded: sorted.some((m) =>
        isBaselineExcludedContact({
          review_reason: m.review_reason,
          in_current_full_db: m.in_current_full_db,
          is_active: m.is_active
        })
      ),
      is_history_only: sorted.some(
        (m) =>
          isEducationOrEventOnlyContact({
            source_file: m.source_file,
            role_raw: m.role_raw,
            review_reason: m.review_reason
          }) &&
          isBaselineExcludedContact({
            review_reason: m.review_reason,
            in_current_full_db: m.in_current_full_db,
            is_active: m.is_active
          })
      ),
      review_required: sorted.some((m) => m.review_required),
      review_reason: primary.review_reason ?? sorted.find((m) => m.review_reason)?.review_reason ?? null
    });
  }

  return rows.sort((a, b) => {
    const company = a.company_name.localeCompare(b.company_name, "ko-KR");
    if (company !== 0) return company;
    return normalizePersonName(a.name).localeCompare(normalizePersonName(b.name), "ko-KR");
  });
}
