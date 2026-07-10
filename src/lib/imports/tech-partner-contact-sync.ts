import {
  appendRoleRawTag,
  TECH_PARTNER_TRAINING_CONTACT_TAG
} from "@/lib/contacts/contact-tags";
import { correctPhoneEmailSwap } from "@/lib/contacts/phone-email";
import { normalizePersonName } from "@/lib/contacts/person-key";
import {
  buildContactFillEmptyPatch,
  type PartnerContactRow,
  type TrainingContactSyncInput
} from "@/lib/imports/training-attendance-contact-sync";

export const TECH_PARTNER_TRAINING_SOURCE = "tech_partner_training_upload";

export type TechPartnerContactSyncInput = {
  partner_id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  memo: string | null;
};

export function findTechPartnerContact(
  contacts: TechPartnerExistingContact[],
  partnerId: string,
  input: Pick<TechPartnerContactSyncInput, "name" | "phone" | "email">
): TechPartnerExistingContact | null {
  const corrected = correctPhoneEmailSwap(input.phone, input.email);
  const nameKey = normalizePersonName(input.name);
  const candidates = contacts.filter(
    (contact) =>
      contact.partner_id === partnerId &&
      !contact.merged_into_contact_id &&
      normalizePersonName(contact.name) === nameKey
  );

  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length > 1) return null;

  return null;
}

export function buildTechPartnerContactInsert(
  input: TechPartnerContactSyncInput
): Record<string, unknown> {
  const corrected = correctPhoneEmailSwap(input.phone, input.email);
  const payload: Record<string, unknown> = {
    partner_id: input.partner_id,
    name: input.name,
    role_type: "engineer",
    role_raw: appendRoleRawTag(null, TECH_PARTNER_TRAINING_CONTACT_TAG),
    is_primary: false,
    is_contract_contact: false,
    is_active: false,
    in_current_full_db: false,
    review_required: true,
    review_reason: "교육 참석 이력에서 자동 생성 — 현재 명단과 별도 검토",
    source_file: TECH_PARTNER_TRAINING_SOURCE,
    last_synced_at: new Date().toISOString()
  };

  if (input.title) payload.position = input.title;
  if (corrected.phone) payload.phone = corrected.phone;
  if (corrected.email) payload.email = corrected.email;
  if (input.memo) payload.memo = input.memo;

  return payload;
}

export type TechPartnerExistingContact = PartnerContactRow & {
  role_raw: string | null;
  merged_into_contact_id?: string | null;
};

export function buildTechPartnerContactPatch(
  existing: TechPartnerExistingContact,
  input: TechPartnerContactSyncInput
): Record<string, unknown> | null {
  const corrected = correctPhoneEmailSwap(input.phone, input.email);
  const patch: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    role_raw: appendRoleRawTag(existing.role_raw, TECH_PARTNER_TRAINING_CONTACT_TAG)
  };

  const fill = buildContactFillEmptyPatch(existing, {
    partner_id: input.partner_id,
    name: input.name,
    department: null,
    position: input.title,
    phone: corrected.phone,
    email: corrected.email,
    memo: input.memo,
    source_file: TECH_PARTNER_TRAINING_SOURCE
  } satisfies TrainingContactSyncInput);

  if (fill) {
    Object.assign(patch, fill);
    if (fill.role_raw) delete patch.role_raw;
    else patch.role_raw = appendRoleRawTag(existing.role_raw, TECH_PARTNER_TRAINING_CONTACT_TAG);
  }

  const hasChanges = Object.keys(patch).length > 1 || patch.role_raw !== existing.role_raw;
  return hasChanges ? patch : null;
}
