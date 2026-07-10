import type { SupabaseClient } from "@supabase/supabase-js";
import { writePartnerChangeLogs } from "@/lib/partners/change-log";

export type SoftDeletePartnersResult = {
  deletedCount: number;
  deletedIds: string[];
  errors: string[];
};

export async function softDeletePartners(
  supabase: SupabaseClient,
  ids: string[],
  userId: string | null
): Promise<SoftDeletePartnersResult> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { deletedCount: 0, deletedIds: [], errors: ["삭제할 파트너를 선택해 주세요."] };
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from("partners")
    .select("id, company_name")
    .in("id", uniqueIds)
    .is("deleted_at", null);

  if (fetchError) {
    return { deletedCount: 0, deletedIds: [], errors: [fetchError.message] };
  }

  const targets = existingRows ?? [];
  if (targets.length === 0) {
    return { deletedCount: 0, deletedIds: [], errors: ["삭제할 파트너를 찾을 수 없습니다."] };
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
    return { deletedCount: 0, deletedIds: [], errors: [updateError.message] };
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
    errors
  };
}
