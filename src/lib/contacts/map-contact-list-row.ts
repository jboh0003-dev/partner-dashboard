import { buildPersonKey } from "@/lib/contacts/person-key";
import { pickCanonicalContact } from "@/lib/contacts/contact-merge";
import { roleLabelFromContact } from "@/lib/contacts/contact-details";
import {
  normalizeSanitizedContactFields,
  sanitizeContactEmailPhone
} from "@/lib/contacts/contact-field-sanitize";
import { collectDisplayRoleLabels } from "@/lib/contacts/role-labels";
import { resolvePhoneDisplay } from "@/lib/contacts/phone-normalize";
import type { PersonContactRow } from "@/lib/contacts/person-groups";

export type ContactListDbRow = {
  id: string;
  partner_id: string;
  name: string;
  department: string | null;
  position: string | null;
  role_type: string | null;
  role_raw: string | null;
  email: string | null;
  phone: string | null;
  phone_display?: string | null;
  phone_normalized?: string | null;
  phone_raw?: string | null;
  is_contract_contact: boolean;
  is_primary?: boolean | null;
  review_required?: boolean | null;
  review_reason?: string | null;
  memo?: string | null;
  created_at?: string;
  is_active?: boolean | null;
  in_current_full_db?: boolean | null;
  source_file?: string | null;
  partner?:
    | { company_name: string; external_no: string | null }
    | { company_name: string; external_no: string | null }[]
    | null;
};

function resolvePartner(row: ContactListDbRow) {
  return Array.isArray(row.partner) ? row.partner[0] : row.partner;
}

/** 기본 목록용 — child table 없이 partner_contacts 컬럼만으로 PersonContactRow 생성 */
export function mapContactToPersonRow(row: ContactListDbRow): PersonContactRow {
  const partner = resolvePartner(row);
  const sanitized = sanitizeContactEmailPhone({ email: row.email, phone: row.phone });
  const normalized = normalizeSanitizedContactFields(sanitized);

  const roleLabels = roleLabelFromContact({
    role_type: row.role_type,
    role_raw: row.role_raw,
    is_contract_contact: row.is_contract_contact
  });

  const displayPhone =
    normalized.phone_display ??
    resolvePhoneDisplay({
      phone: normalized.phone,
      raw_phone: normalized.phone_raw,
      display_phone: row.phone_display
    }) ??
    normalized.phone;
  const normalizedPhone = normalized.phone_normalized?.trim() ?? "";
  const email = normalized.email;

  return {
    id: row.id,
    partner_id: row.partner_id,
    partner_no: partner?.external_no ?? null,
    name: row.name,
    company_name: partner?.company_name ?? "-",
    contract_start_date: null,
    role_type: row.role_type,
    role_raw: row.role_raw,
    department: row.department,
    position: row.position,
    phone: displayPhone,
    email,
    memo: row.memo,
    created_at: row.created_at,
    is_contract_contact: row.is_contract_contact,
    person_key: buildPersonKey(row.partner_id, row.name),
    member_ids: [row.id],
    extra_email_count: 0,
    extra_phone_count: 0,
    role_labels: roleLabels,
    display_role_labels: collectDisplayRoleLabels(roleLabels),
    all_emails: email ? [email] : [],
    all_email_entries: email
      ? [{ email, is_primary: true, is_bounced: false, is_sendable: true }]
      : [],
    all_phones: displayPhone
      ? [{ display: displayPhone, normalized: normalizedPhone, needs_review: false }]
      : [],
    display_phone: displayPhone,
    phone_needs_review: (row.review_reason ?? "").includes("연락처"),
    has_bounced_email:
      (row.review_reason ?? "").includes("반송") ||
      (row.review_reason ?? "").includes("발송 가능한 이메일"),
    has_unsendable_email: (row.review_reason ?? "").includes("발송"),
    is_merge_candidate: false,
    is_baseline_excluded: false,
    is_history_only: false,
    review_required: row.review_required ?? false,
    review_reason: row.review_reason ?? null
  };
}

/** 목록 페이지 내 동일 사람(partner+이름) 중복 row를 1명으로 표시 */
export function dedupePersonRows(rows: PersonContactRow[]): PersonContactRow[] {
  const groups = new Map<string, PersonContactRow[]>();

  for (const row of rows) {
    const list = groups.get(row.person_key) ?? [];
    list.push(row);
    groups.set(row.person_key, list);
  }

  const deduped: PersonContactRow[] = [];

  for (const [, members] of groups) {
    if (members.length === 1) {
      deduped.push(members[0]!);
      continue;
    }

    const canonical = pickCanonicalContact(
      members.map((member) => ({
        id: member.id,
        created_at: member.created_at,
        is_primary: false,
        is_contract_contact: member.is_contract_contact
      }))
    );
    const primary = members.find((member) => member.id === canonical.id) ?? members[0]!;
    deduped.push({
      ...primary,
      member_ids: members.map((member) => member.id),
      is_merge_candidate: true
    });
  }

  return deduped.sort((a, b) => {
    const company = a.company_name.localeCompare(b.company_name, "ko-KR");
    if (company !== 0) return company;
    return a.name.localeCompare(b.name, "ko-KR");
  });
}
