import {
  normalizePhoneInput,
  PHONE_REVIEW_REASON,
  resolvePhoneDisplay
} from "@/lib/contacts/phone-normalize";
import { normalizeContactEmail, isValidContactEmail } from "@/lib/contacts/email-history";
import { getContactAssignmentLabel } from "@/lib/contacts/display";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactEmailRow = {
  id: string;
  contact_id: string;
  email: string;
  is_primary: boolean;
  is_bounced: boolean;
  is_sendable: boolean;
  source: string | null;
};

export type ContactPhoneRow = {
  id: string;
  contact_id: string;
  phone: string;
  raw_phone: string | null;
  normalized_phone: string;
  display_phone: string | null;
  needs_review: boolean;
  is_primary: boolean;
  source: string | null;
};

export type ContactRoleRow = {
  id: string;
  contact_id: string;
  role_name: string;
  source: string | null;
};

export type ContactDetailBundle = {
  emails: ContactEmailRow[];
  phones: ContactPhoneRow[];
  roles: ContactRoleRow[];
};

function appendReviewReason(existing: string | null | undefined, reason: string): string {
  const trimmed = existing?.trim();
  if (!trimmed) return reason;
  if (trimmed.includes(reason)) return trimmed;
  return `${trimmed}; ${reason}`;
}

export function roleLabelFromContact(input: {
  role_type?: string | null;
  role_raw?: string | null;
  is_contract_contact?: boolean;
}): string[] {
  const labels = new Set<string>();
  if (input.is_contract_contact) labels.add("계약담당자");
  if (input.role_raw?.trim()) labels.add(input.role_raw.trim());
  const assignment = getContactAssignmentLabel({
    role_type: input.role_type ?? null,
    role_raw: input.role_raw ?? null,
    is_contract_contact: input.is_contract_contact ?? false
  });
  if (
    assignment &&
    assignment !== "-" &&
    assignment !== "일반 담당자" &&
    assignment !== "일반담당자"
  ) {
    labels.add(assignment);
  }
  return Array.from(labels);
}

export async function fetchContactDetailsByIds(
  supabase: SupabaseClient,
  contactIds: string[]
): Promise<Map<string, ContactDetailBundle>> {
  const map = new Map<string, ContactDetailBundle>();
  if (contactIds.length === 0) return map;

  const uniqueIds = [...new Set(contactIds)];
  const [{ data: emails }, { data: phones }, { data: roles }] = await Promise.all([
    supabase.from("contact_emails").select("*").in("contact_id", uniqueIds),
    supabase.from("contact_phones").select("*").in("contact_id", uniqueIds),
    supabase.from("contact_roles").select("*").in("contact_id", uniqueIds)
  ]);

  for (const id of uniqueIds) {
    map.set(id, { emails: [], phones: [], roles: [] });
  }
  for (const row of (emails ?? []) as ContactEmailRow[]) {
    map.get(row.contact_id)?.emails.push(row);
  }
  for (const row of (phones ?? []) as ContactPhoneRow[]) {
    map.get(row.contact_id)?.phones.push(row);
  }
  for (const row of (roles ?? []) as ContactRoleRow[]) {
    map.get(row.contact_id)?.roles.push(row);
  }
  return map;
}

export type SyncContactDetailsInput = {
  contact_id: string;
  email?: string | null;
  phone?: string | null;
  role_labels?: string[];
  source: string;
  /** 업로드 row에 이메일이 있으면 대표 후보 */
  prefer_upload_email_as_primary?: boolean;
  /** 업로드 row에 연락처가 있으면 대표 후보 */
  prefer_upload_phone_as_primary?: boolean;
};

export type SyncContactDetailsResult = {
  emails_added: number;
  phones_added: number;
  roles_added: number;
  primary_email_updated: boolean;
  primary_phone_updated: boolean;
};

export async function syncContactDetails(
  supabase: SupabaseClient,
  input: SyncContactDetailsInput
): Promise<SyncContactDetailsResult> {
  const result: SyncContactDetailsResult = {
    emails_added: 0,
    phones_added: 0,
    roles_added: 0,
    primary_email_updated: false,
    primary_phone_updated: false
  };

  const { data: contact } = await supabase
    .from("partner_contacts")
    .select("id, email, phone, phone_normalized, review_reason")
    .eq("id", input.contact_id)
    .maybeSingle();

  if (!contact) return result;

  if (input.email?.trim() && isValidContactEmail(input.email)) {
    const normalized = normalizeContactEmail(input.email);
    const { data: existingEmails } = await supabase
      .from("contact_emails")
      .select("id, email, is_primary")
      .eq("contact_id", input.contact_id);

    const emailRows = (existingEmails ?? []) as ContactEmailRow[];
    const hasEmail = emailRows.some((row) => normalizeContactEmail(row.email) === normalized);

    if (!hasEmail) {
      const { error } = await supabase.from("contact_emails").insert({
        contact_id: input.contact_id,
        email: normalized,
        is_primary: emailRows.length === 0,
        source: input.source
      });
      if (!error) result.emails_added += 1;
    }

    const currentPrimary = normalizeContactEmail(contact.email as string | null);
    const shouldSetPrimary =
      input.prefer_upload_email_as_primary &&
      (!currentPrimary || currentPrimary !== normalized);

    if (!currentPrimary || shouldSetPrimary) {
      if (!currentPrimary && contact.email) {
        await supabase.from("contact_emails").upsert(
          {
            contact_id: input.contact_id,
            email: normalizeContactEmail(contact.email as string),
            is_primary: false,
            source: input.source
          },
          { onConflict: "contact_id,email" }
        );
      }
      await supabase
        .from("partner_contacts")
        .update({ email: normalized })
        .eq("id", input.contact_id);
      await supabase
        .from("contact_emails")
        .update({ is_primary: false })
        .eq("contact_id", input.contact_id);
      await supabase
        .from("contact_emails")
        .update({ is_primary: true })
        .eq("contact_id", input.contact_id)
        .eq("email", normalized);
      result.primary_email_updated = shouldSetPrimary || !currentPrimary;
    } else if (currentPrimary && currentPrimary !== normalized) {
      await supabase.from("contact_emails").upsert(
        {
          contact_id: input.contact_id,
          email: normalized,
          is_primary: false,
          source: input.source
        },
        { onConflict: "contact_id,email" }
      );
      if (!hasEmail) result.emails_added += 1;
    }
  }

  if (input.phone?.trim()) {
    const phoneResult = normalizePhoneInput(input.phone);
    if (phoneResult && phoneResult.normalized_phone.length >= 8) {
      const { data: existingPhones } = await supabase
        .from("contact_phones")
        .select("id, normalized_phone, is_primary, needs_review")
        .eq("contact_id", input.contact_id);

      const phoneRows = (existingPhones ?? []) as ContactPhoneRow[];
      const hasPhone = phoneRows.some(
        (row) => row.normalized_phone === phoneResult.normalized_phone
      );

      if (!hasPhone) {
        const { error } = await supabase.from("contact_phones").insert({
          contact_id: input.contact_id,
          phone: phoneResult.display_phone,
          raw_phone: phoneResult.raw_phone,
          normalized_phone: phoneResult.normalized_phone,
          display_phone: phoneResult.display_phone,
          needs_review: phoneResult.needs_review,
          is_primary: phoneRows.length === 0 && !phoneResult.needs_review,
          source: input.source
        });
        if (!error) result.phones_added += 1;
      } else {
        await supabase
          .from("contact_phones")
          .update({
            phone: phoneResult.display_phone,
            raw_phone: phoneResult.raw_phone,
            display_phone: phoneResult.display_phone,
            needs_review: phoneResult.needs_review
          })
          .eq("contact_id", input.contact_id)
          .eq("normalized_phone", phoneResult.normalized_phone);
      }

      const currentPrimaryNormalized = (contact.phone_normalized as string | null)?.trim() || "";
      const shouldSetPrimary =
        input.prefer_upload_phone_as_primary &&
        !phoneResult.needs_review &&
        (!currentPrimaryNormalized ||
          currentPrimaryNormalized !== phoneResult.normalized_phone);

      if (phoneResult.needs_review) {
        await supabase
          .from("partner_contacts")
          .update({
            review_required: true,
            review_reason: appendReviewReason(
              contact.review_reason as string | null,
              PHONE_REVIEW_REASON
            )
          })
          .eq("id", input.contact_id);
      } else if (!currentPrimaryNormalized || shouldSetPrimary) {
        await supabase
          .from("partner_contacts")
          .update({
            phone: phoneResult.display_phone,
            phone_raw: phoneResult.raw_phone,
            phone_normalized: phoneResult.normalized_phone,
            phone_display: phoneResult.display_phone
          })
          .eq("id", input.contact_id);
        await supabase
          .from("contact_phones")
          .update({ is_primary: false })
          .eq("contact_id", input.contact_id);
        await supabase
          .from("contact_phones")
          .update({ is_primary: true })
          .eq("contact_id", input.contact_id)
          .eq("normalized_phone", phoneResult.normalized_phone);
        result.primary_phone_updated = shouldSetPrimary || !currentPrimaryNormalized;
      }
    }
  }

  for (const roleName of input.role_labels ?? []) {
    const trimmed = roleName.trim();
    if (!trimmed) continue;

    const { data: existingRole } = await supabase
      .from("contact_roles")
      .select("id")
      .eq("contact_id", input.contact_id)
      .eq("role_name", trimmed)
      .maybeSingle();

    if (!existingRole) {
      const { error } = await supabase.from("contact_roles").insert({
        contact_id: input.contact_id,
        role_name: trimmed,
        source: input.source
      });
      if (!error) result.roles_added += 1;
    }
  }

  return result;
}
