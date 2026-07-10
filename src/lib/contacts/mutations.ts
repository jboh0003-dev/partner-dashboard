import type { SupabaseClient } from "@supabase/supabase-js";
import { appendPreviousEmail, normalizeContactEmail } from "@/lib/contacts/email-history";
import { collectContactFieldChanges, writePartnerChangeLogs } from "@/lib/partners/change-log";
import {
  normalizeOptionalText,
  summarizeContractContactWarnings,
  validateEmail
} from "@/lib/partners/validators";

export type ContactInput = {
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
  change_reason?: string | null;
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
  "memo"
] as const;

export async function createPartnerContact(
  supabase: SupabaseClient,
  partnerId: string,
  body: ContactInput,
  userId: string | null
) {
  const emailCheck = validateEmail(body.email);
  if (!emailCheck.valid) {
    return { ok: false as const, message: emailCheck.warning ?? "이메일 형식 오류" };
  }

  const payload = {
    partner_id: partnerId,
    name: body.name.trim(),
    department: normalizeOptionalText(body.department),
    position: normalizeOptionalText(body.position),
    role_raw: normalizeOptionalText(body.role_raw),
    role_type: normalizeOptionalText(body.role_type) ?? "etc",
    email: normalizeOptionalText(body.email),
    phone: normalizeOptionalText(body.phone),
    is_contract_contact: body.is_contract_contact ?? false,
    is_primary: false,
    memo: normalizeOptionalText(body.memo),
    is_active: true,
    in_current_full_db: true,
    deleted_at: null,
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
    edited_via_dashboard_at: new Date().toISOString(),
    source_file: "dashboard-manual"
  };

  const { data: inserted, error } = await supabase
    .from("partner_contacts")
    .insert(payload)
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false as const, message: error?.message ?? "담당자 추가 실패" };
  }

  await writePartnerChangeLogs(supabase, partnerId, userId ?? null, [
    {
      entity_type: "contact",
      entity_id: inserted.id as string,
      field_name: "created",
      old_value: null,
      new_value: body.name.trim(),
      reason: body.change_reason ?? null
    }
  ]);

  const warnings = await collectContactWarnings(supabase, partnerId, emailCheck.warning);

  return {
    ok: true as const,
    contact_id: inserted.id as string,
    partner_id: partnerId,
    warnings
  };
}

export async function updatePartnerContact(
  supabase: SupabaseClient,
  contactId: string,
  body: ContactInput,
  userId: string | null
) {
  const emailCheck = validateEmail(body.email);
  if (!emailCheck.valid) {
    return { ok: false as const, message: emailCheck.warning ?? "이메일 형식 오류" };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("partner_contacts")
    .select("*")
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false as const, message: fetchError?.message ?? "담당자를 찾을 수 없습니다." };
  }

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

  const nextEmail = normalizeOptionalText(body.email);
  const previousEmail = normalizeContactEmail(existing.email as string | null);
  const payload: Record<string, unknown> = {
    partner_id: nextPartnerId,
    name: body.name.trim(),
    department: normalizeOptionalText(body.department),
    position: normalizeOptionalText(body.position),
    role_raw: normalizeOptionalText(body.role_raw),
    role_type: normalizeOptionalText(body.role_type) ?? existing.role_type ?? "etc",
    email: nextEmail,
    phone: normalizeOptionalText(body.phone),
    is_contract_contact: body.is_contract_contact ?? false,
    memo: normalizeOptionalText(body.memo),
    updated_at: new Date().toISOString(),
    updated_by: userId ?? null,
    edited_via_dashboard_at: new Date().toISOString()
  };

  if (
    nextEmail &&
    previousEmail &&
    normalizeContactEmail(nextEmail) !== previousEmail
  ) {
    payload.previous_emails = appendPreviousEmail(
      (existing.previous_emails as string[] | null | undefined) ?? [],
      existing.email as string | null
    );
  }

  const { error: updateError } = await supabase
    .from("partner_contacts")
    .update(payload)
    .eq("id", contactId);

  if (updateError) {
    return { ok: false as const, message: updateError.message };
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
  if (nextPartnerId !== previousPartnerId) {
    await writePartnerChangeLogs(supabase, previousPartnerId, userId ?? null, [
      {
        entity_type: "contact",
        entity_id: contactId,
        field_name: "partner_id",
        old_value: previousPartnerId,
        new_value: nextPartnerId,
        reason: body.change_reason ?? null
      }
    ]);
  }

  const warnings = await collectContactWarnings(supabase, nextPartnerId, emailCheck.warning);

  return {
    ok: true as const,
    partner_id: nextPartnerId,
    previous_partner_id: nextPartnerId !== previousPartnerId ? previousPartnerId : undefined,
    warnings
  };
}

export async function deactivatePartnerContact(
  supabase: SupabaseClient,
  contactId: string,
  userId: string | null
) {
  const { data: existing, error: fetchError } = await supabase
    .from("partner_contacts")
    .select("id, name, partner_id")
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false as const, message: fetchError?.message ?? "담당자를 찾을 수 없습니다." };
  }

  const { error: updateError } = await supabase
    .from("partner_contacts")
    .update({
      is_active: false,
      in_current_full_db: false,
      updated_at: new Date().toISOString(),
      updated_by: userId ?? null,
      edited_via_dashboard_at: new Date().toISOString()
    })
    .eq("id", contactId);

  if (updateError) {
    return { ok: false as const, message: updateError.message };
  }

  const partnerId = String(existing.partner_id);
  await writePartnerChangeLogs(supabase, partnerId, userId ?? null, [
    {
      entity_type: "contact",
      entity_id: contactId,
      field_name: "deactivated",
      old_value: String(existing.name),
      new_value: null
    }
  ]);

  return { ok: true as const, partner_id: partnerId };
}

export async function deactivatePartnerContactsBulk(
  supabase: SupabaseClient,
  contactIds: string[],
  userId: string | null
) {
  const errors: string[] = [];
  let deactivatedCount = 0;
  const partnerIds = new Set<string>();

  for (const contactId of contactIds) {
    const result = await deactivatePartnerContact(supabase, contactId, userId);
    if (result.ok) {
      deactivatedCount += 1;
      partnerIds.add(result.partner_id);
    } else {
      errors.push(result.message);
    }
  }

  return { ok: errors.length === 0, deactivatedCount, partnerIds: [...partnerIds], errors };
}

export async function softDeletePartnerContact(
  supabase: SupabaseClient,
  contactId: string,
  userId: string | null
) {
  const { data: existing, error: fetchError } = await supabase
    .from("partner_contacts")
    .select("id, name, partner_id")
    .eq("id", contactId)
    .is("deleted_at", null)
    .maybeSingle();

  if (fetchError || !existing) {
    return { ok: false as const, message: fetchError?.message ?? "담당자를 찾을 수 없습니다." };
  }

  const { error: updateError } = await supabase
    .from("partner_contacts")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: userId ?? null,
      edited_via_dashboard_at: new Date().toISOString()
    })
    .eq("id", contactId);

  if (updateError) {
    return { ok: false as const, message: updateError.message };
  }

  const partnerId = String(existing.partner_id);
  await writePartnerChangeLogs(supabase, partnerId, userId ?? null, [
    {
      entity_type: "contact",
      entity_id: contactId,
      field_name: "deleted",
      old_value: String(existing.name),
      new_value: null
    }
  ]);

  return { ok: true as const, partner_id: partnerId };
}

export async function softDeletePartnerContactsBulk(
  supabase: SupabaseClient,
  contactIds: string[],
  userId: string | null
) {
  const errors: string[] = [];
  let deletedCount = 0;
  const partnerIds = new Set<string>();

  for (const contactId of contactIds) {
    const result = await softDeletePartnerContact(supabase, contactId, userId);
    if (result.ok) {
      deletedCount += 1;
      partnerIds.add(result.partner_id);
    } else {
      errors.push(result.message);
    }
  }

  return { ok: errors.length === 0, deletedCount, partnerIds: [...partnerIds], errors };
}

async function collectContactWarnings(
  supabase: SupabaseClient,
  partnerId: string,
  emailWarning?: string
) {
  const { data: activeContacts } = await supabase
    .from("partner_contacts")
    .select("is_contract_contact")
    .eq("partner_id", partnerId)
    .eq("is_active", true)
    .is("deleted_at", null);

  return [
    ...(emailWarning ? [emailWarning] : []),
    ...summarizeContractContactWarnings(activeContacts ?? [])
  ];
}

export function revalidateContactPaths(partnerId?: string) {
  // Called from API routes via revalidatePath import
  return {
    contacts: "/dashboard/contacts",
    partners: "/dashboard/partners",
    partnerDetail: partnerId ? `/dashboard/partners/${partnerId}` : null
  };
}
