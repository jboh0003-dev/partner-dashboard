import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeContactEmail } from "@/lib/contacts/email-history";
import { normalizeContactPhone } from "@/lib/excel/parse-partner-contacts";
import { roleLabelFromContact, syncContactDetails } from "@/lib/contacts/contact-details";
import { normalizePersonName } from "@/lib/contacts/person-key";

export type MergeContactsResult = {
  master_id: string;
  merged_ids: string[];
  training_attendance_relinked: number;
};

/**
 * secondary → master 병합 (hard delete 없음)
 * - child emails/phones/roles 이동
 * - training_attendance.contact_id 재연결
 * - secondary: merged_into_contact_id + is_active=false
 */
export async function mergeContactsIntoMaster(
  supabase: SupabaseClient,
  masterId: string,
  secondaryIds: string[],
  source = "contact_merge"
): Promise<MergeContactsResult> {
  const uniqueSecondary = secondaryIds.filter((id) => id !== masterId);
  if (uniqueSecondary.length === 0) {
    return { master_id: masterId, merged_ids: [], training_attendance_relinked: 0 };
  }

  const { data: master } = await supabase
    .from("partner_contacts")
    .select("*")
    .eq("id", masterId)
    .maybeSingle();

  if (!master) {
    throw new Error("병합 대상 master contact를 찾을 수 없습니다.");
  }

  const { data: secondaries } = await supabase
    .from("partner_contacts")
    .select("*")
    .in("id", uniqueSecondary)
    .is("deleted_at", null);

  let trainingRelinked = 0;

  for (const secondary of secondaries ?? []) {
    const secondaryId = secondary.id as string;

    await absorbChildEmails(supabase, masterId, secondaryId, source);
    await absorbChildPhones(supabase, masterId, secondaryId, source);
    await absorbChildRoles(supabase, masterId, secondaryId, source);

    await syncContactDetails(supabase, {
      contact_id: masterId,
      email: secondary.email as string | null,
      phone: secondary.phone as string | null,
      role_labels: roleLabelFromContact({
        role_type: secondary.role_type as string | null,
        role_raw: secondary.role_raw as string | null,
        is_contract_contact: secondary.is_contract_contact as boolean
      }),
      source
    });

    const { data: attendanceRows } = await supabase
      .from("training_attendance")
      .select("id")
      .eq("contact_id", secondaryId);

    if ((attendanceRows ?? []).length > 0) {
      const { error } = await supabase
        .from("training_attendance")
        .update({ contact_id: masterId })
        .eq("contact_id", secondaryId);
      if (error) throw new Error(error.message);
      trainingRelinked += (attendanceRows ?? []).length;
    }

    const masterPatch: Record<string, unknown> = {};
    if (!master.department && secondary.department) masterPatch.department = secondary.department;
    if (!master.position && secondary.position) masterPatch.position = secondary.position;
    if (!master.is_contract_contact && secondary.is_contract_contact) {
      masterPatch.is_contract_contact = true;
    }
    if (Object.keys(masterPatch).length > 0) {
      await supabase.from("partner_contacts").update(masterPatch).eq("id", masterId);
    }

    const { error: mergeError } = await supabase
      .from("partner_contacts")
      .update({
        merged_into_contact_id: masterId,
        is_active: false,
        review_required: false,
        review_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", secondaryId);

    if (mergeError) throw new Error(mergeError.message);
  }

  return {
    master_id: masterId,
    merged_ids: uniqueSecondary,
    training_attendance_relinked: trainingRelinked
  };
}

async function absorbChildEmails(
  supabase: SupabaseClient,
  masterId: string,
  secondaryId: string,
  source: string
) {
  const { data: rows } = await supabase
    .from("contact_emails")
    .select("*")
    .eq("contact_id", secondaryId);

  for (const row of rows ?? []) {
    const email = normalizeContactEmail(row.email as string);
    await supabase.from("contact_emails").upsert(
      {
        contact_id: masterId,
        email,
        is_primary: false,
        is_bounced: row.is_bounced,
        is_sendable: row.is_sendable,
        source: row.source ?? source
      },
      { onConflict: "contact_id,email" }
    );
  }
  await supabase.from("contact_emails").delete().eq("contact_id", secondaryId);
}

async function absorbChildPhones(
  supabase: SupabaseClient,
  masterId: string,
  secondaryId: string,
  source: string
) {
  const { data: rows } = await supabase
    .from("contact_phones")
    .select("*")
    .eq("contact_id", secondaryId);

  for (const row of rows ?? []) {
    await supabase.from("contact_phones").upsert(
      {
        contact_id: masterId,
        phone: (row.display_phone as string | null) ?? (row.phone as string),
        raw_phone: row.raw_phone as string | null,
        normalized_phone: row.normalized_phone as string,
        display_phone: row.display_phone as string | null,
        needs_review: (row.needs_review as boolean | null) ?? false,
        is_primary: false,
        source: row.source ?? source
      },
      { onConflict: "contact_id,normalized_phone" }
    );
  }
  await supabase.from("contact_phones").delete().eq("contact_id", secondaryId);
}

async function absorbChildRoles(
  supabase: SupabaseClient,
  masterId: string,
  secondaryId: string,
  source: string
) {
  const { data: rows } = await supabase
    .from("contact_roles")
    .select("*")
    .eq("contact_id", secondaryId);

  for (const row of rows ?? []) {
    await supabase.from("contact_roles").upsert(
      {
        contact_id: masterId,
        role_name: row.role_name as string,
        source: row.source ?? source
      },
      { onConflict: "contact_id,role_name", ignoreDuplicates: true }
    );
  }
  await supabase.from("contact_roles").delete().eq("contact_id", secondaryId);
}

export function findContactsByPersonName<T extends { id: string; name: string; merged_into_contact_id?: string | null }>(
  contacts: T[],
  name: string
): T[] {
  const key = normalizePersonName(name);
  return contacts.filter(
    (contact) =>
      !contact.merged_into_contact_id && normalizePersonName(contact.name) === key
  );
}

export function pickCanonicalContact<T extends { id: string; created_at?: string; is_primary?: boolean; is_contract_contact?: boolean }>(
  contacts: T[]
): T {
  return [...contacts].sort((left, right) => {
    if (left.is_contract_contact !== right.is_contract_contact) {
      return left.is_contract_contact ? -1 : 1;
    }
    if (left.is_primary !== right.is_primary) {
      return left.is_primary ? -1 : 1;
    }
    const leftTime = left.created_at ? new Date(left.created_at).getTime() : 0;
    const rightTime = right.created_at ? new Date(right.created_at).getTime() : 0;
    return leftTime - rightTime;
  })[0]!;
}
