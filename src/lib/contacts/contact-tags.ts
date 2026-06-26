import { CONTACT_ROLE_LABEL } from "@/lib/constants";
import { getContactAssignmentLabel } from "@/lib/contacts/display";

export type ContactTagInput = {
  role_type: string | null;
  role_raw: string | null;
  is_contract_contact: boolean;
  source_file: string | null;
};

const TRAINING_TAG_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /정기교육\s*참석자/i, label: "정기교육 참석자" },
  { pattern: /기술파트너\s*교육\s*참석자/i, label: "기술파트너 교육 참석자" },
  { pattern: /tech_partner_training/i, label: "기술파트너 교육 참석자" },
  { pattern: /training_upload/i, label: "교육 업로드" }
];

export function inferContactTags(contact: ContactTagInput): string[] {
  const tags = new Set<string>();

  if (contact.is_contract_contact) {
    tags.add("계약담당자");
  } else {
    const role = contact.role_type ?? "etc";
    if (role !== "etc") {
      tags.add(CONTACT_ROLE_LABEL[role] ?? role);
    }
  }

  const roleRaw = contact.role_raw?.trim();
  if (roleRaw) {
    for (const part of roleRaw.split(/[/,|]/)) {
      const trimmed = part.trim();
      if (trimmed) tags.add(trimmed);
    }
  }

  const assignment = getContactAssignmentLabel(contact);
  if (assignment && assignment !== "일반 담당자") {
    tags.add(assignment);
  }

  const source = contact.source_file ?? "";
  for (const entry of TRAINING_TAG_PATTERNS) {
    if (entry.pattern.test(source) || entry.pattern.test(roleRaw ?? "")) {
      tags.add(entry.label);
    }
  }

  if (/tech_partner_training_upload|tech_partner_training/i.test(source)) {
    tags.add("기술파트너 교육 참석자");
  }

  return Array.from(tags);
}

export function mergeTagLists(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const tag of list) {
      const key = tag.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(key);
    }
  }
  return merged;
}

export const TECH_PARTNER_TRAINING_CONTACT_TAG = "기술파트너 교육 참석자";

export function appendRoleRawTag(roleRaw: string | null, tag: string): string {
  const existing = roleRaw?.trim() ?? "";
  const parts = existing
    ? existing.split(/[/,|]/).map((p) => p.trim()).filter(Boolean)
    : [];
  if (parts.includes(tag)) return existing || tag;
  parts.push(tag);
  return parts.join(" / ");
}
