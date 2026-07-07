import type { DocumentType } from "@/lib/documents/constants";

export type DocumentDuplicateRow = {
  id: string;
  partner_id: string;
  partner_name?: string;
  document_type: string | null;
  original_filename: string | null;
  display_name: string | null;
  file_name?: string | null;
  file_size: number | null;
  storage_path?: string | null;
  created_at: string;
  is_active?: boolean | null;
  is_duplicate?: boolean | null;
  duplicate_of?: string | null;
  duplicate_reason?: string | null;
  representative?: boolean | null;
  is_primary?: boolean | null;
  priority_score?: number | null;
};

export type DuplicateClassification = "exact" | "near" | "excluded" | "none";

export type DuplicateGroup = {
  key: string;
  partner_id: string;
  partner_name: string;
  document_type: string;
  classification: DuplicateClassification;
  documents: DocumentDuplicateRow[];
  representative_id: string | null;
};

export type DuplicateScanSummary = {
  exact_hidden: number;
  near_candidates: number;
  excluded: number;
  groups: number;
  scanned: number;
};

export const DUPLICATE_REASON = {
  exact_auto: "exact_duplicate_auto",
  near_candidate: "near_duplicate_candidate",
  manual_hidden: "manual_hidden",
  not_duplicate: "not_duplicate",
  new_version: "new_version"
} as const;

const MULTI_DOCUMENT_TYPES = new Set<string>(["security_commitment", "other"]);

const SINGLE_REPRESENTATIVE_TYPES = new Set<string>([
  "partner_application",
  "partner_contract",
  "business_registration",
  "bank_account",
  "company_profile",
  "credit_rating"
]);

export function normalizeDisplayName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeOriginalFilename(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** 보안확약서·기술인력 프로필·사람별 문서 등 복수 허용 */
export function isMultiDocumentAllowed(input: {
  document_type: string | null;
  original_filename: string | null;
  display_name?: string | null;
}): boolean {
  const type = input.document_type ?? "";
  if (MULTI_DOCUMENT_TYPES.has(type)) return true;

  const haystack = `${input.original_filename ?? ""} ${input.display_name ?? ""}`.toLowerCase();
  if (/보안\s*확약|security\s*commitment/.test(haystack)) return true;
  if (/기술\s*인력|인력\s*프로필|technical\s*profile|tech\s*profile/.test(haystack)) return true;
  if (/임직원|직원\s*명단|인사\s*정보/.test(haystack)) return true;
  if (/profile|프로필|resume|\bcv\b|이력\s*서/.test(haystack) && type === "other") return true;

  const filename = input.original_filename ?? "";
  if (/[_\(\[][\uAC00-\uD7A3]{2,4}[_\)\]]/.test(filename)) return true;
  if (/^[\uAC00-\uD7A3]{2,4}[_\-\.]/.test(filename)) return true;

  return false;
}

export function isSingleRepresentativeType(documentType: string | null): boolean {
  return SINGLE_REPRESENTATIVE_TYPES.has(documentType ?? "");
}

export function isVisibleDocument(doc: {
  deleted_at?: string | null;
  is_active?: boolean | null;
  is_duplicate?: boolean | null;
}): boolean {
  if (doc.deleted_at) return false;
  if (doc.is_active === false) return false;
  if (doc.is_duplicate === true) return false;
  return true;
}

export function pickRepresentativeDocument<T extends { created_at: string; priority_score?: number | null }>(
  documents: T[]
): T {
  return [...documents].sort((left, right) => {
    const scoreDiff = (right.priority_score ?? 0) - (left.priority_score ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  })[0]!;
}

export function classifyDuplicateGroup(documents: DocumentDuplicateRow[]): DuplicateClassification {
  if (documents.length < 2) return "none";
  if (documents.some((doc) => isMultiDocumentAllowed(doc))) return "excluded";

  const filenames = new Set(
    documents.map((doc) => normalizeOriginalFilename(doc.original_filename)).filter(Boolean)
  );
  const sizes = new Set(documents.map((doc) => doc.file_size ?? -1));
  const displayNames = new Set(
    documents.map((doc) => normalizeDisplayName(doc.display_name ?? doc.file_name)).filter(Boolean)
  );

  if (filenames.size === 1 && sizes.size === 1) return "exact";

  if (displayNames.size === 1 && filenames.size > 1) return "near";

  return "excluded";
}

function groupKey(partnerId: string, documentType: string, suffix: string): string {
  return `${partnerId}:${documentType}:${suffix}`;
}

export function buildExactDuplicateGroups(documents: DocumentDuplicateRow[]): DuplicateGroup[] {
  const map = new Map<string, DocumentDuplicateRow[]>();

  for (const doc of documents) {
    if (!doc.partner_id || !doc.document_type || !doc.original_filename) continue;
    const key = groupKey(
      doc.partner_id,
      doc.document_type,
      normalizeOriginalFilename(doc.original_filename)
    );
    const bucket = map.get(key) ?? [];
    bucket.push(doc);
    map.set(key, bucket);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, docs] of map.entries()) {
    if (docs.length < 2) continue;
    const classification = classifyDuplicateGroup(docs);
    if (classification === "none" || classification === "excluded") continue;
    const representative = pickRepresentativeDocument(docs);
    groups.push({
      key,
      partner_id: docs[0]!.partner_id,
      partner_name: docs[0]!.partner_name ?? "",
      document_type: docs[0]!.document_type!,
      classification,
      documents: docs,
      representative_id: representative.id
    });
  }

  return groups.sort((left, right) =>
    left.partner_name.localeCompare(right.partner_name, "ko-KR")
  );
}

export function buildNearDuplicateGroups(documents: DocumentDuplicateRow[]): DuplicateGroup[] {
  const map = new Map<string, DocumentDuplicateRow[]>();

  for (const doc of documents) {
    if (!doc.partner_id || !doc.document_type) continue;
    const display = normalizeDisplayName(doc.display_name ?? doc.file_name);
    if (!display) continue;
    const key = groupKey(doc.partner_id, doc.document_type, `display:${display}`);
    const bucket = map.get(key) ?? [];
    bucket.push(doc);
    map.set(key, bucket);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, docs] of map.entries()) {
    if (docs.length < 2) continue;
    const filenames = new Set(docs.map((doc) => normalizeOriginalFilename(doc.original_filename)));
    if (filenames.size < 2) continue;
    if (docs.some((doc) => isMultiDocumentAllowed(doc))) continue;

    const representative = pickRepresentativeDocument(docs);
    groups.push({
      key,
      partner_id: docs[0]!.partner_id,
      partner_name: docs[0]!.partner_name ?? "",
      document_type: docs[0]!.document_type!,
      classification: "near",
      documents: docs,
      representative_id: representative.id
    });
  }

  return groups;
}

export function findRegistrationDuplicate(
  documents: DocumentDuplicateRow[],
  input: {
    partner_id: string;
    document_type: string;
    original_filename: string;
    file_size: number;
  }
): DocumentDuplicateRow | null {
  return (
    documents.find(
      (doc) =>
        doc.partner_id === input.partner_id &&
        doc.document_type === input.document_type &&
        normalizeOriginalFilename(doc.original_filename) ===
          normalizeOriginalFilename(input.original_filename) &&
        (doc.file_size ?? -1) === input.file_size &&
        isVisibleDocument(doc)
    ) ?? null
  );
}

export function groupDocumentsForPartnerTab(documents: DocumentDuplicateRow[]): Array<{
  representative: DocumentDuplicateRow;
  hidden: DocumentDuplicateRow[];
  showHiddenToggle: boolean;
}> {
  const visible = documents.filter((doc) => isVisibleDocument(doc));
  const hidden = documents.filter((doc) => !isVisibleDocument(doc));

  const byType = new Map<string, DocumentDuplicateRow[]>();
  for (const doc of visible) {
    const type = doc.document_type ?? "other";
    const bucket = byType.get(type) ?? [];
    bucket.push(doc);
    byType.set(type, bucket);
  }

  const groups: Array<{
    representative: DocumentDuplicateRow;
    hidden: DocumentDuplicateRow[];
    showHiddenToggle: boolean;
  }> = [];

  for (const docs of byType.values()) {
    if (isMultiDocumentAllowed(docs[0]!)) {
      for (const doc of docs) {
        groups.push({ representative: doc, hidden: [], showHiddenToggle: false });
      }
      continue;
    }

    if (isSingleRepresentativeType(docs[0]?.document_type ?? null) && docs.length === 1) {
      const relatedHidden = hidden.filter(
        (doc) =>
          doc.document_type === docs[0]!.document_type &&
          normalizeDisplayName(doc.display_name ?? doc.file_name) ===
            normalizeDisplayName(docs[0]!.display_name ?? docs[0]!.file_name)
      );
      groups.push({
        representative: docs[0]!,
        hidden: relatedHidden,
        showHiddenToggle: relatedHidden.length > 0
      });
      continue;
    }

    const displayGroups = new Map<string, DocumentDuplicateRow[]>();
    for (const doc of docs) {
      const key = normalizeDisplayName(doc.display_name ?? doc.file_name) || doc.id;
      const bucket = displayGroups.get(key) ?? [];
      bucket.push(doc);
      displayGroups.set(key, bucket);
    }

    for (const bucket of displayGroups.values()) {
      const representative = pickRepresentativeDocument(bucket);
      const others = bucket.filter((doc) => doc.id !== representative.id);
      const relatedHidden = hidden.filter(
        (doc) =>
          doc.document_type === representative.document_type &&
          (doc.duplicate_of === representative.id ||
            normalizeDisplayName(doc.display_name ?? doc.file_name) ===
              normalizeDisplayName(representative.display_name ?? representative.file_name))
      );
      groups.push({
        representative,
        hidden: [...others, ...relatedHidden],
        showHiddenToggle: others.length + relatedHidden.length > 0
      });
    }
  }

  return groups.sort((left, right) => {
    const leftKey = left.representative;
    const rightKey = right.representative;
    const order = [
      "partner_application",
      "company_profile",
      "business_registration",
      "bank_account",
      "credit_rating",
      "partner_contract"
    ];
    const li = order.indexOf(leftKey.document_type ?? "");
    const ri = order.indexOf(rightKey.document_type ?? "");
    if (li !== -1 && ri !== -1 && li !== ri) return li - ri;
    if (li !== -1 && ri === -1) return -1;
    if (li === -1 && ri !== -1) return 1;
    return (leftKey.document_type ?? "").localeCompare(
      rightKey.document_type ?? "",
      "ko-KR"
    );
  });
}

export function documentTypeAllowsMultiple(type: DocumentType | string | null): boolean {
  return isMultiDocumentAllowed({ document_type: type, original_filename: null });
}
