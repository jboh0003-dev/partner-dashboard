import { normalizeContactPhone } from "@/lib/excel/parse-partner-contacts";
import {
  getExactCompanyNameKey,
  normalizeCompanyName,
  normalizePartnerNo
} from "@/lib/partner-match";
import {
  resolveCompanyName,
  type CompanyResolveResult
} from "@/lib/search/fuzzy-company";
import {
  findContactsByPersonName,
  pickCanonicalContact
} from "@/lib/contacts/contact-merge";
import {
  classifyDuplicateGroup,
  type DuplicateContactRecord
} from "@/lib/contacts/duplicate-merge";
import { normalizePersonName } from "@/lib/contacts/person-key";

export type ContactMatchMethod = "partner_name" | "company_name" | "company_fuzzy";

export type ContactLike = {
  id: string;
  partner_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  merged_into_contact_id?: string | null;
  created_at?: string;
  is_primary?: boolean;
  is_contract_contact?: boolean;
};

export type ContactMatchInput = {
  contact_name: string;
  company_name?: string | null;
  normalized_company_name?: string | null;
};

export type ContactMatchResult = {
  contact: ContactLike | null;
  confidence: number;
  method: ContactMatchMethod | null;
  reviewRequired: boolean;
  reason: string;
  duplicateIds: string[];
  manualDuplicateIds: string[];
  duplicateTier: "auto" | "manual" | "none";
};

export type PartnerMatchInput = {
  partner_no?: string | null;
  company_name: string;
  normalized_company_name?: string | null;
};

export type PartnerLike = {
  id: string;
  company_name: string;
  external_no?: string | null;
};

export { normalizePersonName };

export function matchContactByPersonName(
  contactName: string,
  partnerContacts: ContactLike[]
): ContactMatchResult {
  const matches = findContactsByPersonName(partnerContacts, contactName);

  if (matches.length === 0) {
    return {
      contact: null,
      confidence: 0,
      method: null,
      reviewRequired: false,
      reason: "매칭되는 담당자가 없습니다.",
      duplicateIds: [],
      manualDuplicateIds: [],
      duplicateTier: "none"
    };
  }

  const canonical = pickCanonicalContact(matches);
  const duplicateMembers = matches.filter((contact) => contact.id !== canonical.id);

  const classification = classifyDuplicateGroup(
    matches.map((contact) => contact as DuplicateContactRecord)
  );

  const duplicateIds =
    classification.tier === "auto"
      ? duplicateMembers.map((contact) => contact.id)
      : [];
  const manualDuplicateIds =
    classification.tier === "manual"
      ? duplicateMembers.map((contact) => contact.id)
      : [];

  return {
    contact: canonical,
    confidence: 100,
    method: "partner_name",
    reviewRequired: classification.tier === "manual",
    reason:
      duplicateMembers.length > 0
        ? classification.tier === "auto"
          ? `이름 매칭 · 자동 병합 ${duplicateIds.length}건`
          : `이름 매칭 · 수동 확인 필요 (${classification.reason})`
        : "이름 매칭",
    duplicateIds,
    manualDuplicateIds,
    duplicateTier: duplicateMembers.length > 0 ? classification.tier : "none"
  };
}

export function resolvePartnerForContactRow(
  input: PartnerMatchInput,
  partners: PartnerLike[],
  partnersByNo: Map<string, PartnerLike[]>,
  partnersByExactName: Map<string, PartnerLike[]>,
  partnersByNormalizedName: Map<string, PartnerLike[]>,
  normalizePartnerNoFn: (value?: string | null) => string | null,
  getExactCompanyNameKeyFn: (value?: string | null) => string | null
): {
  partner: PartnerLike | null;
  confidence: number;
  method: string;
  reviewRequired: boolean;
  reason: string;
} {
  const partnerNoKey = input.partner_no ? normalizePartnerNoFn(input.partner_no) : null;
  const partnerNoMatches = partnerNoKey ? partnersByNo.get(partnerNoKey) ?? [] : [];

  if (partnerNoKey && partnerNoMatches.length > 1) {
    return {
      partner: null,
      confidence: 0,
      method: "partner_no",
      reviewRequired: true,
      reason: "파트너번호로 여러 파트너가 조회됩니다."
    };
  }
  if (partnerNoMatches[0]) {
    return {
      partner: partnerNoMatches[0],
      confidence: 100,
      method: "partner_no",
      reviewRequired: false,
      reason: "파트너번호 매칭"
    };
  }

  const exactMatches = input.company_name
    ? partnersByExactName.get(getExactCompanyNameKeyFn(input.company_name) ?? "") ?? []
    : [];
  if (exactMatches.length > 1) {
    return {
      partner: null,
      confidence: 0,
      method: "company_exact",
      reviewRequired: true,
      reason: "회사명 원문 완전일치 결과가 여러 건입니다."
    };
  }
  if (exactMatches[0]) {
    return {
      partner: exactMatches[0],
      confidence: 95,
      method: "company_exact",
      reviewRequired: false,
      reason: "회사명 원문 매칭"
    };
  }

  const normalizedMatches = input.normalized_company_name
    ? partnersByNormalizedName.get(input.normalized_company_name) ?? []
    : [];
  if (normalizedMatches.length > 1) {
    return {
      partner: null,
      confidence: 0,
      method: "company_normalized",
      reviewRequired: true,
      reason: "정규화 회사명 후보가 여러 건입니다."
    };
  }
  if (normalizedMatches[0]) {
    return {
      partner: normalizedMatches[0],
      confidence: 85,
      method: "company_normalized",
      reviewRequired: false,
      reason: "회사명 정규화 매칭"
    };
  }

  const fuzzy: CompanyResolveResult = resolveCompanyName(input.company_name, partners);
  if (fuzzy.strategy === "ambiguous") {
    return {
      partner: null,
      confidence: fuzzy.confidence,
      method: "company_fuzzy",
      reviewRequired: true,
      reason: "유사 회사명 후보가 여러 건입니다."
    };
  }
  if (fuzzy.partner && fuzzy.confidence >= 75) {
    return {
      partner: fuzzy.partner,
      confidence: fuzzy.confidence,
      method: "company_fuzzy",
      reviewRequired: false,
      reason: "회사명 유사 매칭"
    };
  }

  return {
    partner: null,
    confidence: 0,
    method: "none",
    reviewRequired: true,
    reason: "매칭되는 파트너가 없습니다."
  };
}

/** partner_id 없을 때 회사명+이름으로 후보 contact 탐색 */
export function matchContactByCompanyAndName(
  contactName: string,
  companyName: string,
  contacts: ContactLike[],
  partnersById: Map<string, PartnerLike>
): ContactMatchResult {
  const companyKey = normalizeCompanyName(companyName);
  const nameKey = normalizePersonName(contactName);

  const matches = contacts.filter((contact) => {
    if (contact.merged_into_contact_id) return false;
    if (normalizePersonName(contact.name) !== nameKey) return false;
    const partner = partnersById.get(contact.partner_id);
    if (!partner) return false;
    const partnerCompany = normalizeCompanyName(partner.company_name);
    return companyKey && partnerCompany === companyKey;
  });

  if (matches.length === 0) {
    return {
      contact: null,
      confidence: 0,
      method: null,
      reviewRequired: false,
      reason: "회사명+이름 매칭 없음",
      duplicateIds: [],
      manualDuplicateIds: [],
      duplicateTier: "none"
    };
  }

  const canonical = pickCanonicalContact(matches);
  const duplicateMembers = matches.filter((contact) => contact.id !== canonical.id);
  const classification = classifyDuplicateGroup(
    matches.map((contact) => contact as DuplicateContactRecord)
  );

  const duplicateIds =
    classification.tier === "auto"
      ? duplicateMembers.map((contact) => contact.id)
      : [];
  const manualDuplicateIds =
    classification.tier === "manual"
      ? duplicateMembers.map((contact) => contact.id)
      : [];

  return {
    contact: canonical,
    confidence: 90,
    method: "company_name",
    reviewRequired: classification.tier === "manual",
    reason:
      duplicateMembers.length > 0
        ? classification.tier === "auto"
          ? `회사명+이름 매칭 · 자동 병합 ${duplicateIds.length}건`
          : `회사명+이름 매칭 · 수동 확인 필요 (${classification.reason})`
        : "회사명+이름 매칭",
    duplicateIds,
    manualDuplicateIds,
    duplicateTier: duplicateMembers.length > 0 ? classification.tier : "none"
  };
}

export { normalizePartnerNo, normalizeCompanyName, getExactCompanyNameKey, normalizeContactPhone };
