import type { SupabaseClient } from "@supabase/supabase-js";
import { writePartnerChangeLogs } from "@/lib/partners/change-log";
import type { PartnerDeleteMode, PartnerDeleteImpact } from "@/lib/partners/delete-types";

export type { PartnerDeleteMode, PartnerDeleteImpact };

export type SoftDeletePartnersResult = {
  deletedCount: number;
  deletedIds: string[];
  errors: string[];
  contactsAffected: number;
};

export async function fetchPartnerDeleteImpact(
  supabase: SupabaseClient,
  ids: string[]
): Promise<PartnerDeleteImpact> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { partner_count: 0, company_names: [], active_contact_count: 0, document_count: 0 };
  }

  const [{ data: partners }, { count: contactCount }, { count: documentCount }] = await Promise.all([
    supabase.from("partners").select("id, company_name").in("id", uniqueIds).is("deleted_at", null),
    supabase
      .from("partner_contacts")
      .select("id", { count: "exact", head: true })
      .in("partner_id", uniqueIds)
      .is("deleted_at", null)
      .eq("is_active", true),
    supabase
      .from("partner_documents")
      .select("id", { count: "exact", head: true })
      .in("partner_id", uniqueIds)
      .is("deleted_at", null)
  ]);

  return {
    partner_count: (partners ?? []).length,
    company_names: (partners ?? []).map((row) => String(row.company_name)),
    active_contact_count: contactCount ?? 0,
    document_count: documentCount ?? 0
  };
}

async function applyContactDeleteMode(
  supabase: SupabaseClient,
  partnerIds: string[],
  mode: PartnerDeleteMode,
  userId: string | null
): Promise<number> {
  if (mode === "partner_only" || partnerIds.length === 0) return 0;

  const now = new Date().toISOString();
  const payload =
    mode === "delete_contacts"
      ? {
          is_active: false,
          in_current_full_db: false,
          deleted_at: now,
          updated_at: now,
          updated_by: userId,
          edited_via_dashboard_at: now
        }
      : {
          is_active: false,
          in_current_full_db: false,
          updated_at: now,
          updated_by: userId,
          edited_via_dashboard_at: now
        };

  const { data, error } = await supabase
    .from("partner_contacts")
    .update(payload)
    .in("partner_id", partnerIds)
    .is("deleted_at", null)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function softDeletePartners(
  supabase: SupabaseClient,
  ids: string[],
  userId: string | null,
  mode: PartnerDeleteMode = "deactivate_contacts"
): Promise<SoftDeletePartnersResult> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { deletedCount: 0, deletedIds: [], errors: ["삭제할 파트너를 선택해 주세요."], contactsAffected: 0 };
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from("partners")
    .select("id, company_name")
    .in("id", uniqueIds)
    .is("deleted_at", null);

  if (fetchError) {
    return { deletedCount: 0, deletedIds: [], errors: [fetchError.message], contactsAffected: 0 };
  }

  const targets = existingRows ?? [];
  if (targets.length === 0) {
    return { deletedCount: 0, deletedIds: [], errors: ["삭제할 파트너를 찾을 수 없습니다."], contactsAffected: 0 };
  }

  const now = new Date().toISOString();
  const targetIds = targets.map((row) => String(row.id));
  const { error: updateError } = await supabase
    .from("partners")
    .update({
      is_active: false,
      deleted_at: now,
      status: "inactive",
      updated_at: now,
      updated_by: userId,
      edited_via_dashboard_at: now
    })
    .in("id", targetIds);

  if (updateError) {
    return { deletedCount: 0, deletedIds: [], errors: [updateError.message], contactsAffected: 0 };
  }

  let contactsAffected = 0;
  try {
    contactsAffected = await applyContactDeleteMode(supabase, targetIds, mode, userId);
  } catch (error) {
    return {
      deletedCount: targetIds.length,
      deletedIds: targetIds,
      errors: [error instanceof Error ? error.message : "연결 담당자 처리에 실패했습니다."],
      contactsAffected: 0
    };
  }

  for (const row of targets) {
    await writePartnerChangeLogs(supabase, String(row.id), userId, [
      {
        entity_type: "partner",
        entity_id: String(row.id),
        field_name: "deleted",
        old_value: String(row.company_name),
        new_value: null
      }
    ]);
  }

  const missing = uniqueIds.filter(
    (id) => !targetIds.includes(id)
  );
  const errors = missing.map((id) => `파트너(${id})를 찾을 수 없거나 이미 삭제되었습니다.`);

  return {
    deletedCount: targetIds.length,
    deletedIds: targetIds,
    errors,
    contactsAffected
  };
}
