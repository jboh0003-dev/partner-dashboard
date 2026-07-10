import type { SupabaseClient } from "@supabase/supabase-js";
import {
  groupDuplicateContacts,
  splitDuplicateGroups,
  type DuplicateGroup
} from "@/lib/contacts/duplicate-merge";

export type DuplicateGroupSummary = {
  total_groups: number;
  auto_groups: number;
  manual_groups: number;
  auto_contacts: number;
  manual_contacts: number;
};

export type DuplicateGroupsResult = {
  groups: DuplicateGroup[];
  auto: DuplicateGroup[];
  manual: DuplicateGroup[];
  summary: DuplicateGroupSummary;
};

const DUPLICATE_CONTACT_SELECT =
  "id, partner_id, name, department, position, role_type, role_raw, email, phone, phone_normalized, merge_keep_separate, merged_into_contact_id, deleted_at, in_current_full_db, is_active";

export async function fetchDuplicateGroups(
  supabase: SupabaseClient
): Promise<DuplicateGroupsResult> {
  const [{ data: contacts, error: contactError }, { data: partners, error: partnerError }] =
    await Promise.all([
      supabase
        .from("partner_contacts")
        .select(DUPLICATE_CONTACT_SELECT)
        .eq("is_active", true)
        .eq("in_current_full_db", true)
        .is("deleted_at", null)
        .is("merged_into_contact_id", null),
      supabase.from("partners").select("id, company_name").is("deleted_at", null)
    ]);

  if (contactError) throw new Error(contactError.message);
  if (partnerError) throw new Error(partnerError.message);

  const companyNameByPartnerId = new Map(
    (partners ?? []).map((partner) => [partner.id as string, partner.company_name as string])
  );

  const groups = groupDuplicateContacts(
    (contacts ?? []).map((row) => ({
      id: row.id as string,
      partner_id: row.partner_id as string,
      name: row.name as string,
      email: row.email as string | null,
      phone: row.phone as string | null,
      phone_normalized: row.phone_normalized as string | null,
      department: row.department as string | null,
      position: row.position as string | null,
      role_raw: row.role_raw as string | null,
      role_type: row.role_type as string | null,
      merge_keep_separate: row.merge_keep_separate as boolean | null,
      merged_into_contact_id: row.merged_into_contact_id as string | null,
      deleted_at: row.deleted_at as string | null,
      in_current_full_db: row.in_current_full_db as boolean | null,
      is_active: row.is_active as boolean | null
    })),
    companyNameByPartnerId
  );

  const { auto, manual } = splitDuplicateGroups(groups);

  return {
    groups,
    auto,
    manual,
    summary: {
      total_groups: groups.length,
      auto_groups: auto.length,
      manual_groups: manual.length,
      auto_contacts: auto.reduce((sum, group) => sum + group.members.length, 0),
      manual_contacts: manual.reduce((sum, group) => sum + group.members.length, 0)
    }
  };
}
