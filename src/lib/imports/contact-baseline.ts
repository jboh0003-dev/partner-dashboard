import type { SupabaseClient } from "@supabase/supabase-js";
import { BASELINE_EXCLUDED_REASON } from "@/lib/imports/partner-contacts";

export const FULL_DB_CONTACT_SOURCE = "full_db";

export function buildBaselineActivePayload(options?: {
  keepReviewRequired?: boolean;
}): Record<string, unknown> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    in_current_full_db: true,
    is_active: true,
    contact_source: FULL_DB_CONTACT_SOURCE,
    last_seen_in_full_sync_at: now,
    last_synced_at: now,
    deleted_at: null,
    merged_into_contact_id: null
  };

  if (!options?.keepReviewRequired) {
    payload.review_required = false;
    payload.review_reason = null;
  }

  return payload;
}

export function buildContactBaselineExcludedPayload(): Record<string, unknown> {
  return {
    in_current_full_db: false,
    is_active: false,
    review_required: false,
    review_reason: BASELINE_EXCLUDED_REASON,
    last_synced_at: new Date().toISOString()
  };
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function activateBaselineContacts(
  supabase: SupabaseClient,
  contactIds: string[],
  reviewRequiredIds: Set<string>
): Promise<void> {
  const uniqueIds = [...new Set(contactIds)];
  if (uniqueIds.length === 0) return;

  const defaultIds = uniqueIds.filter((id) => !reviewRequiredIds.has(id));
  const reviewIds = uniqueIds.filter((id) => reviewRequiredIds.has(id));

  for (const chunk of chunkArray(defaultIds, 100)) {
    const { error } = await supabase
      .from("partner_contacts")
      .update(buildBaselineActivePayload())
      .in("id", chunk);
    if (error) throw new Error(error.message);
  }

  for (const chunk of chunkArray(reviewIds, 100)) {
    const { error } = await supabase
      .from("partner_contacts")
      .update(buildBaselineActivePayload({ keepReviewRequired: true }))
      .in("id", chunk);
    if (error) throw new Error(error.message);
  }
}

export async function excludeContactsNotInBaseline(
  supabase: SupabaseClient,
  syncedContactIds: Set<string>
): Promise<Array<{ id: string; source_file: string | null; role_raw: string | null; review_reason: string | null }>> {
  const allContacts: Array<{
    id: string;
    source_file: string | null;
    role_raw: string | null;
    review_reason: string | null;
  }> = [];

  // PostgREST 기본 1000행 제한 — 반드시 페이지네이션
  const pageSize = 1000;
  let from = 0;
  for (;;) {
    const { data, error: fetchError } = await supabase
      .from("partner_contacts")
      .select("id, source_file, role_raw, review_reason")
      .is("deleted_at", null)
      .is("merged_into_contact_id", null)
      .range(from, from + pageSize - 1);
    if (fetchError) throw new Error(fetchError.message);
    const rows = (data ?? []) as typeof allContacts;
    allContacts.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  const toExcludeIds = allContacts
    .map((row) => row.id)
    .filter((id) => !syncedContactIds.has(id));

  if (toExcludeIds.length === 0) return [];

  const excludedRows: Array<{
    id: string;
    source_file: string | null;
    role_raw: string | null;
    review_reason: string | null;
  }> = [];

  for (const chunk of chunkArray(toExcludeIds, 100)) {
    const { data, error } = await supabase
      .from("partner_contacts")
      .update(buildContactBaselineExcludedPayload())
      .in("id", chunk)
      .select("id, source_file, role_raw, review_reason");
    if (error) throw new Error(error.message);
    excludedRows.push(...((data ?? []) as typeof excludedRows));
  }

  return excludedRows;
}

export async function countActiveBaselineContacts(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from("partner_contacts")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("in_current_full_db", true)
    .is("deleted_at", null)
    .is("merged_into_contact_id", null);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
