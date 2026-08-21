import type { ParsedPartnerContactRow } from "@/lib/excel/parse-partner-contacts";
import { isFlagLikeContactName } from "@/lib/excel/parse-partner-contacts";
import {
  matchContactByCompanyAndName,
  matchContactByPersonName,
  resolvePartnerForContactRow,
  type ContactLike
} from "@/lib/contacts/contact-match";
import {
  getExactCompanyNameKey,
  normalizeCompanyName,
  normalizePartnerNo
} from "@/lib/partner-match";

export type PartnerContactsPartnerRow = {
  id: string;
  company_name: string;
  external_no?: string | null;
};

export type PartnerContactsDbRow = ContactLike & {
  department: string | null;
  position: string | null;
  role_type: string | null;
  role_raw: string | null;
  is_primary: boolean;
  is_contract_contact: boolean;
  is_active?: boolean | null;
  in_current_full_db?: boolean | null;
  deleted_at?: string | null;
  merged_into_contact_id?: string | null;
  review_required?: boolean | null;
  review_reason?: string | null;
  source_file?: string | null;
  contact_source?: string | null;
};

export type PartnerContactsAnalysisAction =
  | "create"
  | "update"
  | "merge"
  | "skip"
  | "review"
  | "duplicate";

export type PartnerContactsAnalysisItem = {
  row_number: number;
  partner_no: string | null;
  company_name: string;
  contact_name: string;
  role_raw: string | null;
  role_type: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  is_contract_contact: boolean;
  action: PartnerContactsAnalysisAction;
  reason: string;
  match_confidence: number | null;
  match_method: string | null;
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  matched_contact_id: string | null;
  merge_contact_ids: string[];
  manual_duplicate_ids: string[];
  review_duplicate: boolean;
};

export type BaselineExclusionCategory =
  | "active_current_missing"
  | "history_only"
  | "already_inactive";

export type PartnerContactsBaselineExcludedItem = {
  contact_id: string;
  partner_id: string;
  partner_name: string;
  contact_name: string;
  email: string | null;
  reason: string;
  is_history_only: boolean;
  category: BaselineExclusionCategory;
};

export const FULL_SYNC_MISSING_REASON = "새 전체DB 업로드 파일에서 누락됨";
export const BASELINE_EXCLUDED_REASON = "이전 기준 데이터에서 제외됨";
export const HISTORY_ONLY_PRESERVE_REASON = "교육/행사 이력 보존 대상 (현재 명단 제외 아님)";
export const ALREADY_INACTIVE_REASON = "이미 비활성/기준명단 제외 상태";

const EDUCATION_SOURCE_HINTS = [
  "교육",
  "training",
  "tech-partner",
  "tech_partner",
  "정기교육",
  "event",
  "행사"
];

export const DASHBOARD_MANUAL_SOURCE_FILE = "dashboard-manual";
export const DASHBOARD_MANUAL_CONTACT_SOURCE = "dashboard_manual";

export function isDashboardManualContact(contact: {
  source_file?: string | null;
  contact_source?: string | null;
}): boolean {
  const sourceFile = (contact.source_file ?? "").trim().toLowerCase();
  if (sourceFile === DASHBOARD_MANUAL_SOURCE_FILE) return true;
  const contactSource = (contact.contact_source ?? "").trim().toLowerCase();
  return contactSource === DASHBOARD_MANUAL_CONTACT_SOURCE || contactSource === "manual";
}

export function isActiveCurrentBaselineContact(contact: {
  is_active?: boolean | null;
  in_current_full_db?: boolean | null;
}): boolean {
  return contact.is_active === true && contact.in_current_full_db === true;
}

export function isEducationOrEventOnlyContact(contact: {
  source_file?: string | null;
  role_raw?: string | null;
  review_reason?: string | null;
  contact_source?: string | null;
}): boolean {
  const contactSource = (contact.contact_source ?? "").toLowerCase();
  if (contactSource === "education" || contactSource === "event") {
    return true;
  }
  const source = (contact.source_file ?? "").toLowerCase();
  if (EDUCATION_SOURCE_HINTS.some((hint) => source.includes(hint.toLowerCase()))) {
    return true;
  }
  const roleRaw = (contact.role_raw ?? "").replace(/\s+/g, "");
  if (roleRaw.includes("정기교육참석") || roleRaw.includes("교육참석")) {
    return true;
  }
  const reviewReason = contact.review_reason ?? "";
  if (reviewReason.includes("교육 참석") || reviewReason.includes("교육/행사")) {
    return true;
  }
  return false;
}

export type PartnerContactsAnalysisSummary = {
  total: number;
  matched_partners: number;
  create: number;
  update: number;
  merge: number;
  skip: number;
  review: number;
  duplicate: number;
  /** @deprecated use baseline_excluded (A only) */
  review_missing: number;
  /** A: active+current 중 최신 전체DB 누락 */
  baseline_excluded: number;
  /** B: 교육/행사 이력 보존 */
  history_only_preserved: number;
  /** C: 이미 비활성/기준명단 제외 — 신규 제외로 세지 않음 */
  already_inactive: number;
};

export const PARTNER_CONTACTS_ACTION_LABEL: Record<PartnerContactsAnalysisAction, string> = {
  create: "신규 담당자",
  update: "기존 담당자 갱신",
  merge: "중복 병합",
  skip: "제외",
  review: "이름 없음/검토 필요",
  duplicate: "중복 의심"
};

export function analyzePartnerContactRows(
  rows: ParsedPartnerContactRow[],
  partners: PartnerContactsPartnerRow[],
  contacts: PartnerContactsDbRow[],
  historyContactIds?: Set<string>
): {
  items: PartnerContactsAnalysisItem[];
  baselineExcluded: PartnerContactsBaselineExcludedItem[];
  historyOnlyPreserved: PartnerContactsBaselineExcludedItem[];
  alreadyInactive: PartnerContactsBaselineExcludedItem[];
  summary: PartnerContactsAnalysisSummary;
} {
  const partnersByNo = new Map<string, PartnerContactsPartnerRow[]>();
  const partnersByExactName = new Map<string, PartnerContactsPartnerRow[]>();
  const partnersByNormalizedName = new Map<string, PartnerContactsPartnerRow[]>();
  const partnersById = new Map(partners.map((p) => [p.id, p]));
  const contactsByPartner = new Map<string, PartnerContactsDbRow[]>();
  const canonicalContacts = contacts.filter(
    (c) => !c.merged_into_contact_id && !c.deleted_at
  );

  for (const partner of partners) {
    const partnerNo = normalizePartnerNo(partner.external_no);
    if (partnerNo) {
      const list = partnersByNo.get(partnerNo) ?? [];
      list.push(partner);
      partnersByNo.set(partnerNo, list);
    }
    const exact = getExactCompanyNameKey(partner.company_name);
    if (exact) {
      const list = partnersByExactName.get(exact) ?? [];
      list.push(partner);
      partnersByExactName.set(exact, list);
    }
    const normalized = normalizeCompanyName(partner.company_name);
    if (normalized) {
      const list = partnersByNormalizedName.get(normalized) ?? [];
      list.push(partner);
      partnersByNormalizedName.set(normalized, list);
    }
  }

  for (const contact of canonicalContacts) {
    const list = contactsByPartner.get(contact.partner_id) ?? [];
    list.push(contact);
    contactsByPartner.set(contact.partner_id, list);
  }

  const items = rows.map((row) =>
    analyzeRow(
      row,
      partners,
      partnersById,
      partnersByNo,
      partnersByExactName,
      partnersByNormalizedName,
      contactsByPartner,
      canonicalContacts
    )
  );

  const classified = classifyContactsMissingFromFullDb(
    items,
    canonicalContacts,
    partners,
    historyContactIds
  );
  const baselineExcluded = classified.active_current_missing;

  const summary = items.reduce<PartnerContactsAnalysisSummary>(
    (acc, item) => {
      acc.total += 1;
      if (item.matched_partner_id) acc.matched_partners += 1;
      acc[item.action] += 1;
      return acc;
    },
    {
      total: 0,
      matched_partners: 0,
      create: 0,
      update: 0,
      merge: 0,
      skip: 0,
      review: 0,
      duplicate: 0,
      review_missing: baselineExcluded.length,
      baseline_excluded: baselineExcluded.length,
      history_only_preserved: classified.history_only.length,
      already_inactive: classified.already_inactive.length
    }
  );

  return {
    items,
    baselineExcluded,
    historyOnlyPreserved: classified.history_only,
    alreadyInactive: classified.already_inactive,
    summary
  };
}

function analyzeRow(
  row: ParsedPartnerContactRow,
  partners: PartnerContactsPartnerRow[],
  partnersById: Map<string, PartnerContactsPartnerRow>,
  partnersByNo: Map<string, PartnerContactsPartnerRow[]>,
  partnersByExactName: Map<string, PartnerContactsPartnerRow[]>,
  partnersByNormalizedName: Map<string, PartnerContactsPartnerRow[]>,
  contactsByPartner: Map<string, PartnerContactsDbRow[]>,
  allCanonicalContacts: PartnerContactsDbRow[]
): PartnerContactsAnalysisItem {
  const base = toAnalysisBase(row);

  if (row.excluded) {
    const isReview =
      (row.excluded_reason ?? "").includes("검토") ||
      (row.excluded_reason ?? "").includes("잘못된 담당자 이름");
    return emptyMatch({
      ...base,
      action: isReview ? "review" : "skip",
      reason: row.excluded_reason ?? "제외"
    });
  }

  if (isFlagLikeContactName(row.contact_name)) {
    return emptyMatch({
      ...base,
      action: "review",
      reason: "담당자 이름이 계약담당자 플래그(O)로 보입니다."
    });
  }

  const partnerMatch = resolvePartnerForContactRow(
    {
      partner_no: row.partner_no,
      company_name: row.company_name,
      normalized_company_name: row.normalized_company_name
    },
    partners,
    partnersByNo,
    partnersByExactName,
    partnersByNormalizedName,
    normalizePartnerNo,
    getExactCompanyNameKey
  );

  if (partnerMatch.reviewRequired || !partnerMatch.partner) {
    const companyMatch = matchContactByCompanyAndName(
      row.contact_name,
      row.company_name,
      allCanonicalContacts,
      partnersById
    );
    if (companyMatch.contact) {
      return matchedItem(
        base,
        partnerMatch.partner ?? partnersById.get(companyMatch.contact.partner_id) ?? null,
        companyMatch,
        row
      );
    }
    const action = partnerMatch.reason.includes("여러") ? "duplicate" : "review";
    return emptyMatch({
      ...base,
      action,
      reason: partnerMatch.reason,
      match_confidence: partnerMatch.confidence || null,
      match_method: partnerMatch.method,
      matched_partner_id: partnerMatch.partner?.id ?? null,
      matched_partner_name: partnerMatch.partner?.company_name ?? null
    });
  }

  const matchedPartner = partnerMatch.partner;
  const partnerContacts = contactsByPartner.get(matchedPartner.id) ?? [];

  const contactMatch = matchContactByPersonName(row.contact_name, partnerContacts);

  if (contactMatch.contact) {
    return matchedItem(base, matchedPartner, contactMatch, row, partnerMatch.reason);
  }

  return {
    ...base,
    action: "create",
    reason: `${partnerMatch.reason} · 신규 담당자`,
    match_confidence: null,
    match_method: null,
    matched_partner_id: matchedPartner.id,
    matched_partner_name: matchedPartner.company_name,
    matched_contact_id: null,
    merge_contact_ids: [],
    manual_duplicate_ids: [],
    review_duplicate: false
  };
}

function matchedItem(
  base: ReturnType<typeof toAnalysisBase>,
  partner: PartnerContactsPartnerRow | null,
  contactMatch: ReturnType<typeof matchContactByPersonName>,
  row: ParsedPartnerContactRow,
  partnerReason?: string
): PartnerContactsAnalysisItem {
  const prefix = partnerReason ? `${partnerReason} · ` : "";
  const hasAutoMerge = contactMatch.duplicateIds.length > 0;
  const hasManualDup = contactMatch.manualDuplicateIds.length > 0;

  let action: PartnerContactsAnalysisAction;
  if (hasAutoMerge) {
    action = "merge";
  } else {
    action = "update";
  }

  return {
    ...base,
    action,
    reason: `${prefix}${contactMatch.reason}`,
    match_confidence: contactMatch.confidence,
    match_method: contactMatch.method,
    matched_partner_id: partner?.id ?? contactMatch.contact?.partner_id ?? null,
    matched_partner_name: partner?.company_name ?? row.company_name,
    matched_contact_id: contactMatch.contact?.id ?? null,
    merge_contact_ids: contactMatch.duplicateIds,
    manual_duplicate_ids: contactMatch.manualDuplicateIds,
    review_duplicate: hasManualDup
  };
}

function collectSyncedContactIds(items: PartnerContactsAnalysisItem[]): Set<string> {
  const syncedContactIds = new Set<string>();
  for (const item of items) {
    if (!["create", "update", "merge"].includes(item.action)) continue;
    if (item.matched_contact_id) syncedContactIds.add(item.matched_contact_id);
    for (const id of item.merge_contact_ids) syncedContactIds.add(id);
    for (const id of item.manual_duplicate_ids) syncedContactIds.add(id);
  }
  return syncedContactIds;
}

function toBaselineItem(
  contact: PartnerContactsDbRow,
  partnerNameById: Map<string, string>,
  category: BaselineExclusionCategory,
  reason: string
): PartnerContactsBaselineExcludedItem {
  const historyOnly = isEducationOrEventOnlyContact(contact);
  return {
    contact_id: contact.id,
    partner_id: contact.partner_id,
    partner_name: partnerNameById.get(contact.partner_id) ?? "(알 수 없음)",
    contact_name: contact.name,
    email: contact.email ?? null,
    reason,
    is_history_only: historyOnly,
    category
  };
}

function sortBaselineItems(
  items: PartnerContactsBaselineExcludedItem[]
): PartnerContactsBaselineExcludedItem[] {
  return items.sort((a, b) => {
    const byPartner = a.partner_name.localeCompare(b.partner_name, "ko-KR");
    if (byPartner !== 0) return byPartner;
    return a.contact_name.localeCompare(b.contact_name, "ko-KR");
  });
}

/**
 * 최신 전체DB에 없는 기존 contact를 A/B/C로 분류한다.
 * A active_current_missing: is_active && in_current_full_db
 * B history_only: 교육/행사 이력 보존 (현재 명단 제외로 세지 않음)
 * C already_inactive: 이미 비활성/기준명단 제외
 */
export function classifyContactsMissingFromFullDb(
  items: PartnerContactsAnalysisItem[],
  contacts: PartnerContactsDbRow[],
  partners: PartnerContactsPartnerRow[],
  historyContactIds?: Set<string>
): {
  active_current_missing: PartnerContactsBaselineExcludedItem[];
  history_only: PartnerContactsBaselineExcludedItem[];
  already_inactive: PartnerContactsBaselineExcludedItem[];
} {
  const partnerNameById = new Map(partners.map((p) => [p.id, p.company_name]));
  const syncedContactIds = collectSyncedContactIds(items);

  const active_current_missing: PartnerContactsBaselineExcludedItem[] = [];
  const history_only: PartnerContactsBaselineExcludedItem[] = [];
  const already_inactive: PartnerContactsBaselineExcludedItem[] = [];

  for (const contact of contacts) {
    if (contact.deleted_at) continue;
    if (contact.merged_into_contact_id) continue;
    if (syncedContactIds.has(contact.id)) continue;
    if (isDashboardManualContact(contact)) continue;

    const historyOnly =
      isEducationOrEventOnlyContact(contact) || Boolean(historyContactIds?.has(contact.id));

    if (isActiveCurrentBaselineContact(contact)) {
      active_current_missing.push(
        toBaselineItem(contact, partnerNameById, "active_current_missing", FULL_SYNC_MISSING_REASON)
      );
      continue;
    }

    if (historyOnly) {
      history_only.push(
        toBaselineItem(contact, partnerNameById, "history_only", HISTORY_ONLY_PRESERVE_REASON)
      );
      continue;
    }

    already_inactive.push(
      toBaselineItem(contact, partnerNameById, "already_inactive", ALREADY_INACTIVE_REASON)
    );
  }

  return {
    active_current_missing: sortBaselineItems(active_current_missing),
    history_only: sortBaselineItems(history_only),
    already_inactive: sortBaselineItems(already_inactive)
  };
}

/** A만 반환 — UI '현재 목록 제외 예정' */
export function analyzeBaselineExcluded(
  items: PartnerContactsAnalysisItem[],
  contacts: PartnerContactsDbRow[],
  partners: PartnerContactsPartnerRow[],
  historyContactIds?: Set<string>
): PartnerContactsBaselineExcludedItem[] {
  return classifyContactsMissingFromFullDb(items, contacts, partners, historyContactIds)
    .active_current_missing;
}

/** @deprecated analyzeBaselineExcluded 사용 */
export function analyzeFullSyncReviewMissing(
  items: PartnerContactsAnalysisItem[],
  contacts: PartnerContactsDbRow[],
  partners: PartnerContactsPartnerRow[]
): PartnerContactsBaselineExcludedItem[] {
  return analyzeBaselineExcluded(items, contacts, partners);
}

function toAnalysisBase(row: ParsedPartnerContactRow) {
  return {
    row_number: row.row_number,
    partner_no: row.partner_no,
    company_name: row.company_name,
    contact_name: row.contact_name,
    role_raw: row.role_raw,
    role_type: row.role_type,
    department: row.department,
    position: row.position,
    phone: row.phone,
    email: row.email,
    is_contract_contact: row.is_contract_contact
  };
}

function emptyMatch(
  item: Partial<PartnerContactsAnalysisItem> & ReturnType<typeof toAnalysisBase> & { action: PartnerContactsAnalysisAction; reason: string }
): PartnerContactsAnalysisItem {
  return {
    ...item,
    match_confidence: item.match_confidence ?? null,
    match_method: item.match_method ?? null,
    matched_partner_id: item.matched_partner_id ?? null,
    matched_partner_name: item.matched_partner_name ?? null,
    matched_contact_id: item.matched_contact_id ?? null,
    merge_contact_ids: item.merge_contact_ids ?? [],
    manual_duplicate_ids: item.manual_duplicate_ids ?? [],
    review_duplicate: item.review_duplicate ?? false
  };
}
