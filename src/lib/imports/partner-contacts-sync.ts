import { normalizePhoneInput, PHONE_REVIEW_REASON } from "@/lib/contacts/phone-normalize";
import {
  normalizeSanitizedContactFields,
  sanitizeContactEmailPhone,
  SWAPPED_FIELDS_REVIEW_REASON
} from "@/lib/contacts/contact-field-sanitize";
import { isFlagLikeContactName } from "@/lib/excel/parse-partner-contacts";
import { roleLabelFromContact } from "@/lib/contacts/contact-details";
import {
  buildBaselineActivePayload,
  buildContactBaselineExcludedPayload,
  FULL_DB_CONTACT_SOURCE
} from "@/lib/imports/contact-baseline";
import { UPLOAD_TYPE } from "@/lib/imports/upload-types";

export type ContactImportRow = {
  contact_name: string;
  role_raw: string | null;
  role_type: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  is_contract_contact: boolean;
  source_file: string;
};

export type ContactImportContext = {
  row: ContactImportRow;
  existingContact?: { review_reason?: string | null } | null;
  matchConfidence?: number | null;
  matchMethod?: string | null;
};

export function applySanitizedEmailPhoneToPayload(
  payload: Record<string, unknown>,
  email: string | null | undefined,
  phone: string | null | undefined
): { corrected: boolean; needsReview: boolean } {
  const sanitized = sanitizeContactEmailPhone({ email, phone });
  const normalized = normalizeSanitizedContactFields(sanitized);
  let needsReview = false;

  if (normalized.email) {
    payload.email = normalized.email;
  }

  const phoneNeedsReview = applyNormalizedPhoneToPayload(payload, normalized.phone);
  needsReview = phoneNeedsReview;

  if (sanitized.ambiguous) {
    payload.review_required = true;
    payload.review_reason = SWAPPED_FIELDS_REVIEW_REASON;
    needsReview = true;
  }

  return { corrected: sanitized.swapped, needsReview };
}

export function applyNormalizedPhoneToPayload(
  payload: Record<string, unknown>,
  phone: string | null | undefined
): boolean {
  if (!phone?.trim()) return false;
  const result = normalizePhoneInput(phone);
  if (!result) return false;

  payload.phone = result.display_phone;
  payload.phone_raw = result.raw_phone;
  payload.phone_normalized = result.normalized_phone;
  payload.phone_display = result.display_phone;

  if (result.needs_review) {
    payload.review_required = true;
    payload.review_reason = PHONE_REVIEW_REASON;
    return true;
  }
  return false;
}

/**
 * 저장 중 데이터 payload.
 * in_current_full_db / is_active 는 여기서 바꾸지 않는다.
 * baseline은 전체 저장 성공 후 activateBaselineContacts로 한 번에 전환한다.
 */
export function buildContactDataPayload(context: ContactImportContext): Record<string, unknown> {
  const { row, matchConfidence, matchMethod } = context;
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    role_type: row.role_type,
    role_raw: row.role_raw,
    is_contract_contact: row.is_contract_contact,
    source_file: row.source_file,
    contact_source: FULL_DB_CONTACT_SOURCE,
    last_synced_at: now,
    deleted_at: null,
    merged_into_contact_id: null
  };

  if (row.contact_name && !isFlagLikeContactName(row.contact_name)) {
    payload.name = row.contact_name;
  }
  if (row.department) payload.department = row.department;
  if (row.position) payload.position = row.position;

  if (matchConfidence != null) payload.match_confidence = matchConfidence;
  if (matchMethod) payload.match_method = matchMethod;

  return payload;
}

/** @deprecated buildContactDataPayload 사용 — baseline 플래그 즉시 적용 금지 */
export function buildContactUpsertPayload(context: ContactImportContext): Record<string, unknown> {
  return {
    ...buildContactDataPayload(context),
    ...buildBaselineActivePayload()
  };
}

export { buildContactBaselineExcludedPayload };

/** @deprecated buildContactBaselineExcludedPayload 사용 */
export function buildContactReviewMissingPayload(): Record<string, unknown> {
  return buildContactBaselineExcludedPayload();
}

export function buildRoleLabelsFromImportRow(row: ContactImportRow): string[] {
  return roleLabelFromContact({
    role_type: row.role_type,
    role_raw: row.role_raw,
    is_contract_contact: row.is_contract_contact
  });
}

export const FULL_SYNC_IMPORT_TYPE = UPLOAD_TYPE.CONTACT_FULL_DB;

export type ImportStatsAccumulator = {
  created: number;
  updated: number;
  merged: number;
  emails_added: number;
  phones_added: number;
  roles_added: number;
  baseline_excluded: number;
  history_only_excluded: number;
  corrected_count: number;
  current_baseline_count: number;
  active_current_count: number;
};

export function emptyImportStats(): ImportStatsAccumulator {
  return {
    created: 0,
    updated: 0,
    merged: 0,
    emails_added: 0,
    phones_added: 0,
    roles_added: 0,
    baseline_excluded: 0,
    history_only_excluded: 0,
    corrected_count: 0,
    current_baseline_count: 0,
    active_current_count: 0
  };
}

export function buildBaselineResetStartPayload(): Record<string, unknown> {
  return {
    in_current_full_db: false
  };
}
