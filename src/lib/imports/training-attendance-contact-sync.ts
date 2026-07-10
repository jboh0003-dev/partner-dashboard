import { normalizePersonName } from "@/lib/contacts/person-key";

export type PartnerContactRow = {
  id: string;
  partner_id: string;
  name: string;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  memo: string | null;
  merged_into_contact_id?: string | null;
};

export type TrainingContactSyncInput = {
  partner_id: string;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  memo: string | null;
  source_file: string;
};

export function findContactForTrainingSync(
  contacts: PartnerContactRow[],
  partnerId: string,
  input: Pick<TrainingContactSyncInput, "name" | "email" | "phone">
): PartnerContactRow | null {
  const nameKey = normalizePersonName(input.name);
  const candidates = contacts.filter(
    (contact) =>
      contact.partner_id === partnerId &&
      !contact.merged_into_contact_id &&
      normalizePersonName(contact.name) === nameKey
  );

  if (candidates.length === 1) return candidates[0]!;
  return null;
}

export function buildReferenceContactInsert(
  input: TrainingContactSyncInput
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    partner_id: input.partner_id,
    name: input.name,
    role_type: "etc",
    role_raw: "정기교육 참석자",
    is_primary: false,
    is_contract_contact: false,
    is_active: false,
    in_current_full_db: false,
    review_required: true,
    review_reason: "교육 참석 이력에서 자동 생성 — 현재 명단과 별도 검토",
    source_file: input.source_file,
    last_synced_at: new Date().toISOString()
  };

  if (input.department) payload.department = input.department;
  if (input.position) payload.position = input.position;
  if (input.phone) payload.phone = input.phone;
  if (input.email) payload.email = input.email;
  if (input.memo) payload.memo = input.memo;

  return payload;
}

export function buildContactFillEmptyPatch(
  existing: PartnerContactRow,
  input: TrainingContactSyncInput
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {
    last_synced_at: new Date().toISOString()
  };

  if (!existing.department && input.department) patch.department = input.department;
  if (!existing.position && input.position) patch.position = input.position;
  if (!existing.phone && input.phone) patch.phone = input.phone;
  if (!existing.email && input.email) patch.email = input.email;
  if (!existing.memo && input.memo) patch.memo = input.memo;

  if (Object.keys(patch).length <= 1) return null;
  return patch;
}

export function hasContactSyncData(input: TrainingContactSyncInput): boolean {
  return Boolean(
    input.department || input.position || input.phone || input.email || input.memo
  );
}
