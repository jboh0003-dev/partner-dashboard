import { normalizeContactEmail } from "@/lib/contacts/email-history";
import { pickCanonicalContact } from "@/lib/contacts/contact-merge";
import { normalizePersonName, buildPersonKey } from "@/lib/contacts/person-key";
import { normalizePhoneInput } from "@/lib/contacts/phone-normalize";

export type DuplicateMergeTier = "auto" | "manual";

export type DuplicateContactRecord = {
  id: string;
  partner_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  phone_normalized?: string | null;
  department?: string | null;
  position?: string | null;
  role_raw?: string | null;
  role_type?: string | null;
  merge_keep_separate?: boolean | null;
  merged_into_contact_id?: string | null;
  deleted_at?: string | null;
  in_current_full_db?: boolean | null;
  is_active?: boolean | null;
};

export type DuplicateGroup = {
  person_key: string;
  partner_id: string;
  company_name: string;
  name: string;
  members: DuplicateContactRecord[];
  tier: DuplicateMergeTier;
  reason: string;
};

export function normalizePhoneKey(
  phone: string | null | undefined,
  normalized?: string | null
): string {
  if (normalized?.trim()) return normalized.trim();
  return normalizePhoneInput(phone)?.normalized_phone ?? "";
}

function normalizeDeptPosition(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function setsAreAllDistinct(values: string[]): boolean {
  const filtered = values.filter(Boolean);
  if (filtered.length <= 1) return false;
  return new Set(filtered).size === filtered.length;
}

/** 같은 사람 그룹 내 자동/수동 병합 판정 */
export function classifyDuplicateGroup(members: DuplicateContactRecord[]): {
  tier: DuplicateMergeTier;
  reason: string;
} {
  if (members.length <= 1) {
    return { tier: "auto", reason: "단일 contact" };
  }

  if (members.some((member) => member.merge_keep_separate)) {
    return { tier: "manual", reason: "별도 인물로 유지 설정됨" };
  }

  const partnerIds = new Set(members.map((member) => member.partner_id));
  if (partnerIds.size > 1) {
    return { tier: "manual", reason: "이름은 같지만 회사(파트너)가 다름" };
  }

  const nameKeys = new Set(members.map((member) => normalizePersonName(member.name)));
  if (nameKeys.size > 1) {
    return { tier: "manual", reason: "회사는 같지만 이름이 완전히 같지 않음" };
  }

  // 같은 partner + 같은 이름 → 이메일/연락처/담당구분 차이만 있어도 자동 병합
  return { tier: "auto", reason: "동일 회사·동일 이름" };
}

export function groupDuplicateContacts(
  contacts: DuplicateContactRecord[],
  companyNameByPartnerId: Map<string, string>
): DuplicateGroup[] {
  const groups = new Map<string, DuplicateContactRecord[]>();

  for (const contact of contacts) {
    if (contact.deleted_at) continue;
    if (contact.merged_into_contact_id) continue;
    if (contact.merge_keep_separate) continue;

    const key = buildPersonKey(contact.partner_id, contact.name);
    const list = groups.get(key) ?? [];
    list.push(contact);
    groups.set(key, list);
  }

  const result: DuplicateGroup[] = [];

  for (const [person_key, members] of groups) {
    if (members.length <= 1) continue;
    const primary = members[0]!;
    const { tier, reason } = classifyDuplicateGroup(members);
    result.push({
      person_key,
      partner_id: primary.partner_id,
      company_name: companyNameByPartnerId.get(primary.partner_id) ?? "-",
      name: primary.name,
      members,
      tier,
      reason
    });
  }

  return result.sort((a, b) => {
    const company = a.company_name.localeCompare(b.company_name, "ko-KR");
    if (company !== 0) return company;
    return normalizePersonName(a.name).localeCompare(normalizePersonName(b.name), "ko-KR");
  });
}

export function splitDuplicateGroups(groups: DuplicateGroup[]): {
  auto: DuplicateGroup[];
  manual: DuplicateGroup[];
} {
  return {
    auto: groups.filter((group) => group.tier === "auto"),
    manual: groups.filter((group) => group.tier === "manual")
  };
}

export function autoMergeContactIds(group: DuplicateGroup): string[] {
  if (group.tier !== "auto" || group.members.length <= 1) return [];
  const master = pickCanonicalContact(group.members);
  return group.members.filter((member) => member.id !== master.id).map((member) => member.id);
}

export function pickDuplicateMasterId(group: DuplicateGroup): string {
  return pickCanonicalContact(group.members).id;
}
