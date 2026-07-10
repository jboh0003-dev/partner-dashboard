import type { SupabaseClient } from "@supabase/supabase-js";
import { serializeFieldValue } from "@/lib/partners/validators";

export type ChangeLogEntry = {
  entity_type: "partner" | "contact";
  entity_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  reason?: string | null;
};

export function collectFieldChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): ChangeLogEntry[] {
  const changes: ChangeLogEntry[] = [];

  for (const field of fields) {
    const oldValue = serializeFieldValue(before[field]);
    const newValue = serializeFieldValue(after[field]);
    if (oldValue === newValue) continue;
    changes.push({
      entity_type: "partner",
      entity_id: String(before.id ?? after.id ?? ""),
      field_name: field,
      old_value: oldValue,
      new_value: newValue
    });
  }

  return changes;
}

export function collectContactFieldChanges(
  contactId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): ChangeLogEntry[] {
  return collectFieldChanges(before, after, fields).map((entry) => ({
    ...entry,
    entity_type: "contact" as const,
    entity_id: contactId
  }));
}

export async function writePartnerChangeLogs(
  supabase: SupabaseClient,
  partnerId: string,
  changedBy: string | null,
  entries: ChangeLogEntry[]
) {
  if (entries.length === 0) return;

  const rows = entries.map((entry) => ({
    partner_id: partnerId,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    field_name: entry.field_name,
    old_value: entry.old_value,
    new_value: entry.new_value,
    changed_by: changedBy ?? null,
    reason: entry.reason ?? null
  }));

  const { error } = await supabase.from("partner_change_logs").insert(rows);
  if (error) {
    console.error("[partner-change-log] insert failed", { partnerId, error: error.message });
  }
}
