import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeContactEmail } from "@/lib/contacts/email-history";
import {
  normalizeSanitizedContactFields,
  sanitizeContactEmailPhone,
  SWAPPED_FIELDS_REVIEW_REASON
} from "@/lib/contacts/contact-field-sanitize";
import {
  fetchContactDetailsByIds,
  type ContactEmailRow,
  type ContactPhoneRow,
  type ContactRoleRow
} from "@/lib/contacts/contact-details";
import { normalizePhoneInput } from "@/lib/contacts/phone-normalize";
import { collectContactFieldChanges, writePartnerChangeLogs } from "@/lib/partners/change-log";
import { normalizeOptionalText, validateEmail } from "@/lib/partners/validators";
import { syncContactEmailReviewFlags } from "@/lib/contacts/contact-review-sync";

export type ContactEmailInput = {
  id?: string;
  email: string;
  is_primary?: boolean;
  is_bounced?: boolean;
  is_sendable?: boolean;
  _delete?: boolean;
};

export type ContactPhoneInput = {
  id?: string;
  phone: string;
  is_primary?: boolean;
  _delete?: boolean;
};

export type ContactRoleInput = {
  id?: string;
  role_name: string;
  _delete?: boolean;
};

export type FullContactUpdateInput = {
  partner_id?: string;
  name: string;
  department?: string | null;
  position?: string | null;
  role_raw?: string | null;
  role_type?: string | null;
  email?: string | null;
  phone?: string | null;
  is_contract_contact?: boolean;
  memo?: string | null;
  is_active?: boolean;
  review_required?: boolean;
  review_reason?: string | null;
  change_reason?: string | null;
  emails?: ContactEmailInput[];
  phones?: ContactPhoneInput[];
  roles?: ContactRoleInput[];
};

const CONTACT_LOG_FIELDS = [
  "partner_id",
  "name",
  "department",
  "position",
  "role_raw",
  "role_type",
  "email",
  "phone",
  "is_contract_contact",
  "memo",
  "is_active",
  "review_required"
] as const;

export async function fetchFullContact(supabase: SupabaseClient, contactId: string) {
  const { data: contact, error } = await supabase
    .from("partner_contacts")
    .select("*")
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !contact) {
    return { ok: false as const, message: error?.message ?? "담당자를 찾을 수 없습니다." };
  }

  const details = await fetchContactDetailsByIds(supabase, [contactId]);
  const bundle = details.get(contactId) ?? { emails: [], phones: [], roles: [] };

  return {
    ok: true as const,
    contact,
    emails: bundle.emails,
    phones: bundle.phones,
    roles: bundle.roles
  };
}

export async function updateFullContact(
  supabase: SupabaseClient,
  contactId: string,
  body: FullContactUpdateInput,
  userId: string | null
) {
  const sanitized = sanitizeContactEmailPhone({ email: body.email, phone: body.phone });
  const normalizedFields = normalizeSanitizedContactFields(sanitized);

  const emailCheck = validateEmail(normalizedFields.email);
  if (!emailCheck.valid) {
    return { ok: false as const, message: emailCheck.warning ?? "이메일 형식 오류" };
  }

  const existingResult = await fetchFullContact(supabase, contactId);
  if (!existingResult.ok) {
    return { ok: false as const, message: existingResult.message };
  }

  const existing = existingResult.contact;
  const previousPartnerId = String(existing.partner_id);
  let nextPartnerId = previousPartnerId;

  if (body.partner_id && body.partner_id !== previousPartnerId) {
    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .select("id")
      .eq("id", body.partner_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (partnerError || !partner) {
      return { ok: false as const, message: "파트너를 찾을 수 없습니다." };
    }
    nextPartnerId = body.partner_id;
  }

  const payload: Record<string, unknown> = {
    partner_id: nextPartnerId,
    name: body.name.trim(),
    department: normalizeOptionalText(body.department),
    position: normalizeOptionalText(body.position),
    role_raw: normalizeOptionalText(body.role_raw),
    role_type: normalizeOptionalText(body.role_type) ?? existing.role_type ?? "etc",
    email: normalizedFields.email,
    phone: normalizedFields.phone_display ?? normalizedFields.phone,
    phone_raw: normalizedFields.phone_raw,
    phone_normalized: normalizedFields.phone_normalized,
    phone_display: normalizedFields.phone_display,
    is_contract_contact: body.is_contract_contact ?? false,
    memo: normalizeOptionalText(body.memo),
    is_active: body.is_active ?? existing.is_active ?? true,
    review_required:
      body.review_required ??
      (sanitized.ambiguous ? true : (existing.review_required ?? false)),
    review_reason:
      body.review_reason !== undefined
        ? normalizeOptionalText(body.review_reason)
        : sanitized.ambiguous
          ? SWAPPED_FIELDS_REVIEW_REASON
          : existing.review_reason,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
    edited_via_dashboard_at: new Date().toISOString()
  };

  const { error: updateError } = await supabase
    .from("partner_contacts")
    .update(payload)
    .eq("id", contactId);

  if (updateError) {
    return { ok: false as const, message: updateError.message };
  }

  if (body.emails) {
    await syncEmails(supabase, contactId, body.emails, existingResult.emails);
    await syncContactEmailReviewFlags(supabase, contactId);
  }
  if (body.phones) {
    await syncPhones(supabase, contactId, body.phones, existingResult.phones);
  }
  if (body.roles) {
    await syncRoles(supabase, contactId, body.roles, existingResult.roles);
  }

  const primaryEmail = body.emails?.find((row) => row.is_primary && !row._delete)?.email;
  if (primaryEmail) {
    await supabase
      .from("partner_contacts")
      .update({ email: normalizeContactEmail(primaryEmail) })
      .eq("id", contactId);
  }

  const primaryPhone = body.phones?.find((row) => row.is_primary && !row._delete)?.phone;
  if (primaryPhone) {
    const normalized = normalizePhoneInput(primaryPhone);
    if (normalized) {
      await supabase
        .from("partner_contacts")
        .update({
          phone: normalized.display_phone,
          phone_raw: normalized.raw_phone,
          phone_normalized: normalized.normalized_phone,
          phone_display: normalized.display_phone
        })
        .eq("id", contactId);
    }
  }

  const changes = collectContactFieldChanges(
    contactId,
    existing,
    { ...existing, ...payload },
    [...CONTACT_LOG_FIELDS]
  ).map((entry) => ({
    ...entry,
    reason: body.change_reason ?? null
  }));

  await writePartnerChangeLogs(supabase, nextPartnerId, userId ?? null, changes);

  return {
    ok: true as const,
    partner_id: nextPartnerId,
    previous_partner_id: nextPartnerId !== previousPartnerId ? previousPartnerId : undefined,
    warnings: emailCheck.warning ? [emailCheck.warning] : []
  };
}

async function syncEmails(
  supabase: SupabaseClient,
  contactId: string,
  inputs: ContactEmailInput[],
  existing: ContactEmailRow[]
) {
  for (const row of inputs) {
    const normalized = normalizeContactEmail(row.email);
    if (!normalized) continue;

    if (row._delete && row.id) {
      await supabase.from("contact_emails").delete().eq("id", row.id);
      continue;
    }

    if (row.id) {
      await supabase
        .from("contact_emails")
        .update({
          email: normalized,
          is_primary: row.is_primary ?? false,
          is_bounced: row.is_bounced ?? false,
          is_sendable: row.is_sendable ?? true
        })
        .eq("id", row.id);
    } else {
      await supabase.from("contact_emails").upsert(
        {
          contact_id: contactId,
          email: normalized,
          is_primary: row.is_primary ?? false,
          is_bounced: row.is_bounced ?? false,
          is_sendable: row.is_sendable ?? true,
          source: "dashboard-edit"
        },
        { onConflict: "contact_id,email" }
      );
    }
  }

  const primaryId = inputs.find((row) => row.is_primary && !row._delete)?.id;
  if (primaryId) {
    await supabase.from("contact_emails").update({ is_primary: false }).eq("contact_id", contactId);
    await supabase.from("contact_emails").update({ is_primary: true }).eq("id", primaryId);
  } else if (!existing.some((row) => row.is_primary) && existing[0]) {
    await supabase.from("contact_emails").update({ is_primary: true }).eq("id", existing[0].id);
  }
}

async function syncPhones(
  supabase: SupabaseClient,
  contactId: string,
  inputs: ContactPhoneInput[],
  existing: ContactPhoneRow[]
) {
  for (const row of inputs) {
    const normalized = normalizePhoneInput(row.phone);
    if (!normalized) continue;

    if (row._delete && row.id) {
      await supabase.from("contact_phones").delete().eq("id", row.id);
      continue;
    }

    if (row.id) {
      await supabase
        .from("contact_phones")
        .update({
          phone: normalized.display_phone,
          raw_phone: normalized.raw_phone,
          normalized_phone: normalized.normalized_phone,
          display_phone: normalized.display_phone,
          needs_review: normalized.needs_review,
          is_primary: row.is_primary ?? false
        })
        .eq("id", row.id);
    } else {
      await supabase.from("contact_phones").upsert(
        {
          contact_id: contactId,
          phone: normalized.display_phone,
          raw_phone: normalized.raw_phone,
          normalized_phone: normalized.normalized_phone,
          display_phone: normalized.display_phone,
          needs_review: normalized.needs_review,
          is_primary: row.is_primary ?? false,
          source: "dashboard-edit"
        },
        { onConflict: "contact_id,normalized_phone" }
      );
    }
  }

  const primaryNormalized = inputs.find((row) => row.is_primary && !row._delete);
  if (primaryNormalized) {
    const normalized = normalizePhoneInput(primaryNormalized.phone);
    if (normalized) {
      await supabase.from("contact_phones").update({ is_primary: false }).eq("contact_id", contactId);
      await supabase
        .from("contact_phones")
        .update({ is_primary: true })
        .eq("contact_id", contactId)
        .eq("normalized_phone", normalized.normalized_phone);
    }
  } else if (!existing.some((row) => row.is_primary) && existing[0]) {
    await supabase.from("contact_phones").update({ is_primary: true }).eq("id", existing[0].id);
  }
}

async function syncRoles(
  supabase: SupabaseClient,
  contactId: string,
  inputs: ContactRoleInput[],
  existing: ContactRoleRow[]
) {
  for (const row of inputs) {
    const roleName = row.role_name.trim();
    if (!roleName) continue;

    if (row._delete && row.id) {
      await supabase.from("contact_roles").delete().eq("id", row.id);
      continue;
    }

    if (!row.id) {
      const exists = existing.some((item) => item.role_name === roleName);
      if (!exists) {
        await supabase.from("contact_roles").insert({
          contact_id: contactId,
          role_name: roleName,
          source: "dashboard-edit"
        });
      }
    }
  }
}
