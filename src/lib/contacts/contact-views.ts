import type { PersonContactRow } from "@/lib/contacts/person-groups";
import { BASELINE_EXCLUDED_REASON } from "@/lib/imports/partner-contacts";
import { isEducationOrEventOnlyContact } from "@/lib/imports/partner-contacts";

export type ContactListView =
  | "all"
  | "review"
  | "merge"
  | "bounced"
  | "inactive"
  | "excluded"
  | "history_only";

export const CONTACT_VIEW_LABEL: Record<ContactListView, string> = {
  all: "현재 인력/담당자",
  review: "확인 필요",
  merge: "중복 병합 후보",
  bounced: "반송 이메일",
  inactive: "비활성/제외 인원",
  excluded: "제외된 인원",
  history_only: "교육/행사 이력만 있는 인원"
};

export function parseContactListView(value?: string | null): ContactListView {
  const normalized = (value ?? "all").trim().toLowerCase();
  if (
    normalized === "review" ||
    normalized === "merge" ||
    normalized === "bounced" ||
    normalized === "inactive" ||
    normalized === "excluded" ||
    normalized === "history_only"
  ) {
    return normalized;
  }
  return "all";
}

export function buildContactViewHref(
  view: ContactListView,
  params: { q?: string; role?: string; partnerId?: string }
): string {
  const search = new URLSearchParams();
  if (view !== "all") search.set("view", view);
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.role && params.role !== "all") search.set("role", params.role);
  if (params.partnerId?.trim()) search.set("partnerId", params.partnerId.trim());
  const query = search.toString();
  return query ? `/dashboard/contacts?${query}` : "/dashboard/contacts";
}

export function buildContactsClearFilterHref(params: {
  q?: string;
  role?: string;
  partnerId?: string;
}): string {
  return buildContactViewHref("all", params);
}

export function filterPersonRowsByView(
  rows: PersonContactRow[],
  view: ContactListView
): PersonContactRow[] {
  switch (view) {
    case "review":
      return rows.filter((row) => row.review_required);
    case "merge":
      return rows.filter((row) => row.is_merge_candidate);
    case "bounced":
      return rows.filter(
        (row) =>
          row.has_bounced_email ||
          row.has_unsendable_email ||
          (row.review_reason?.includes("이메일") ?? false)
      );
    case "excluded":
      return rows.filter((row) => row.is_baseline_excluded);
    case "history_only":
      return rows.filter((row) => row.is_history_only);
    case "inactive":
      return rows;
    case "all":
    default:
      return rows;
  }
}

export function countMergeCandidates(
  contacts: Array<{ partner_id: string; name: string; company_name: string }>,
  isSample: (name: string) => boolean,
  buildPersonKey: (partnerId: string, name: string) => string
): number {
  const groups = new Map<string, number>();
  for (const contact of contacts) {
    if (isSample(contact.company_name)) continue;
    const key = buildPersonKey(contact.partner_id, contact.name);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let candidates = 0;
  for (const count of groups.values()) {
    if (count > 1) candidates += 1;
  }
  return candidates;
}

export function isBaselineExcludedContact(input: {
  review_reason?: string | null;
  in_current_full_db?: boolean | null;
  is_active?: boolean | null;
}): boolean {
  if (input.review_reason === BASELINE_EXCLUDED_REASON) return true;
  return input.in_current_full_db === false && input.is_active === false;
}

export { isEducationOrEventOnlyContact };
