import { isCanonicalContact, normalizePersonName } from "@/lib/contacts/person-key";
import { stripPhoneDigits } from "@/lib/contacts/phone-normalize";
import { formatContactRole } from "@/lib/data/search";
import type { SearchContext } from "@/lib/data/search";
import {
  detectQueryEntities,
  leftoverQueryTokens,
  queryHasContactHint,
  queryHasEngineerRoleHint,
  queryHasSalesRoleHint,
  queryHasTrainingHint
} from "@/lib/search/entity-detect";
import {
  analyzeKoreanQuery,
  compactKoreanQuery,
  requestedFieldsFromConcepts,
  type QueryConcept
} from "@/lib/search/korean-query-lexicon";
import { resolveCompanyName } from "@/lib/search/fuzzy-company";
import type { SearchContactItem, SearchResult } from "@/lib/search/types";
import type { Partner, PartnerContact } from "@/types/partner";

const NO_DATA = "현재 등록된 데이터에서 확인되지 않습니다.";

function partnerOf(contact: PartnerContact, context: SearchContext): Partner | undefined {
  return context.partners.find((partner) => partner.id === contact.partner_id);
}

function filterByRoleHint(hits: PartnerContact[], query: string): PartnerContact[] {
  if (queryHasSalesRoleHint(query)) {
    const sales = hits.filter(
      (hit) => hit.role_type === "sales" || (hit.role_raw ?? "").includes("영업")
    );
    if (sales.length > 0) return sales;
  }
  if (queryHasEngineerRoleHint(query)) {
    const engineers = hits.filter(
      (hit) =>
        hit.role_type === "engineer" ||
        hit.role_type === "tech" ||
        (hit.role_raw ?? "").includes("기술")
    );
    if (engineers.length > 0) return engineers;
  }
  return hits;
}

function splitCompanyPersonRemainder(
  leftover: string[],
  context: SearchContext
): {
  partnerId: string | null;
  personToken: string | null;
  companyResolved: ReturnType<typeof resolveCompanyName>;
} {
  const joined = leftover.join(" ");
  const companyResolved =
    leftover.length > 0
      ? resolveCompanyName(joined, context.partners)
      : {
          partner: null,
          strategy: "none" as const,
          confidence: 0,
          candidates: [],
          queryUsed: null
        };

  const compactRem = compactKoreanQuery(leftover.join(""));
  const partnersByLen = [...context.partners].sort(
    (a, b) => compactKoreanQuery(b.company_name).length - compactKoreanQuery(a.company_name).length
  );
  for (const partner of partnersByLen) {
    const key = compactKoreanQuery(partner.company_name);
    if (key.length < 2) continue;
    if (compactRem === key) {
      return {
        partnerId: partner.id,
        personToken: null,
        companyResolved: { ...companyResolved, partner, strategy: "exact", confidence: 1 }
      };
    }
    if (compactRem.startsWith(key) && compactRem.length > key.length) {
      const rest = compactRem.slice(key.length);
      if (/^[가-힣]{2,5}$/.test(rest)) {
        return {
          partnerId: partner.id,
          personToken: rest,
          companyResolved: { ...companyResolved, partner, strategy: "exact", confidence: 1 }
        };
      }
    }
  }

  const hangulTokens = leftover.filter((token) => /^[가-힣]{2,5}$/.test(token));
  const personToken =
    hangulTokens.find((token) => findContactsByPersonName(token, context, companyResolved.partner?.id ?? null).length > 0) ??
    hangulTokens.find((token) => {
      const asCompany = resolveCompanyName(token, context.partners);
      return !(asCompany.partner && asCompany.confidence >= 0.9);
    }) ??
    null;

  return {
    partnerId: companyResolved.partner?.id ?? null,
    personToken,
    companyResolved
  };
}

function phoneDigits(contact: PartnerContact): string {
  return stripPhoneDigits(contact.phone_normalized || contact.phone || "");
}

export function toSearchContactItem(
  contact: PartnerContact,
  partnerName: string
): SearchContactItem {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    role: formatContactRole(contact.role_type),
    position: contact.position,
    partnerId: contact.partner_id,
    partnerName
  };
}

export function findContactsByEmail(email: string, context: SearchContext): PartnerContact[] {
  const key = email.trim().toLowerCase();
  return context.contacts.filter(
    (contact) =>
      isCanonicalContact(contact) && (contact.email ?? "").trim().toLowerCase() === key
  );
}

export function findContactsByPhone(digits: string, context: SearchContext): PartnerContact[] {
  const needle = stripPhoneDigits(digits);
  if (needle.length < 4) return [];
  return context.contacts.filter((contact) => {
    if (!isCanonicalContact(contact)) return false;
    const value = phoneDigits(contact);
    return value === needle || value.endsWith(needle) || needle.endsWith(value);
  });
}

export function findContactsByPersonName(
  name: string,
  context: SearchContext,
  partnerId?: string | null
): PartnerContact[] {
  const key = normalizePersonName(name);
  if (key.length < 2) return [];
  const canonical = context.contacts.filter((contact) => {
    if (!isCanonicalContact(contact)) return false;
    if (partnerId && contact.partner_id !== partnerId) return false;
    return true;
  });
  const exact = canonical.filter((contact) => normalizePersonName(contact.name) === key);
  if (exact.length > 0) return exact;
  return canonical.filter((contact) => normalizePersonName(contact.name).includes(key));
}

export function findContactsBySurnamePrefix(
  prefix: string,
  context: SearchContext,
  partnerId?: string | null
): PartnerContact[] {
  const key = prefix.trim();
  if (!key) return [];
  return context.contacts.filter((contact) => {
    if (!isCanonicalContact(contact)) return false;
    if (partnerId && contact.partner_id !== partnerId) return false;
    return contact.name.trim().startsWith(key);
  });
}

function formatContactRoleLabel(contact: PartnerContact): string | null {
  return formatContactRole(contact.role_type) || contact.role_raw || null;
}

function synthesizeContactAnswer(
  contact: PartnerContact,
  partner: Partner | undefined,
  concepts: QueryConcept[]
): string {
  const company = partner?.company_name;
  const role = formatContactRoleLabel(contact);
  const intro = company
    ? `${contact.name} 님은 ${company}${role ? ` ${role} 담당자` : ""}입니다.`
    : `${contact.name} 님 정보입니다.`;
  const fields = requestedFieldsFromConcepts(concepts);
  const wantAll = fields.length === 0 || concepts.includes("person_profile");
  const lines = [intro];
  if (wantAll || fields.includes("affiliation") || concepts.includes("affiliation")) {
    if (company && !intro.includes(company)) lines.push(`파트너사: ${company}`);
  }
  if ((wantAll || fields.includes("role")) && role) {
    if (!intro.includes(role)) lines.push(`담당구분/업무: ${[role, contact.role_raw].filter(Boolean).join(" / ")}`);
  }
  if ((wantAll || fields.includes("department") || fields.includes("position")) && (contact.department || contact.position)) {
    lines.push(`부서/직급: ${[contact.department, contact.position].filter(Boolean).join(" / ")}`);
  }
  if ((wantAll || fields.includes("phone") || concepts.includes("phone") || concepts.includes("person_profile")) && contact.phone) {
    lines.push(`전화: ${contact.phone}`);
  }
  if ((wantAll || fields.includes("email") || concepts.includes("email") || concepts.includes("person_profile") || concepts.includes("phone")) && contact.email) {
    lines.push(`이메일: ${contact.email}`);
  }
  return lines.filter(Boolean).join("\n");
}

export function buildContactSearchResult(
  hits: PartnerContact[],
  context: SearchContext,
  options?: { ambiguousName?: string; extraAnswer?: string; query?: string }
): SearchResult {
  if (hits.length === 0) {
    return {
      answer: NO_DATA,
      intent: "contact_lookup",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources: [{ type: "partner_contacts", label: "인력/담당자 DB" }],
      matchStrategy: "none",
      menuLinks: [{ label: "인력·담당자", href: "/dashboard/contacts" }]
    };
  }

  const uniquePartners = new Map<string, Partner>();
  for (const hit of hits) {
    const partner = partnerOf(hit, context);
    if (partner) uniquePartners.set(partner.id, partner);
  }

  const contacts = hits.map((hit) =>
    toSearchContactItem(hit, partnerOf(hit, context)?.company_name ?? "-")
  );

  const items = hits.map((hit) => {
    const partner = partnerOf(hit, context);
    return {
      id: hit.id,
      title: hit.name,
      subtitle: [
        partner?.company_name,
        formatContactRole(hit.role_type),
        hit.department,
        hit.position,
        hit.phone,
        hit.email
      ]
        .filter(Boolean)
        .join(" · "),
      href: partner
        ? `/dashboard/partners/${partner.id}?tab=organization`
        : "/dashboard/contacts"
    };
  });

  const concepts = options?.query ? analyzeKoreanQuery(options.query).concepts : [];
  const ambiguous = hits.length > 1 && options?.ambiguousName;
  const answer = ambiguous
    ? `동일 이름이 여러 명 있습니다.\n${hits
        .slice(0, 8)
        .map((hit) => `- ${hit.name} / ${partnerOf(hit, context)?.company_name ?? "-"}`)
        .join("\n")}`
    : [synthesizeContactAnswer(hits[0]!, partnerOf(hits[0]!, context), concepts), options?.extraAnswer]
        .filter(Boolean)
        .join("\n\n");

  const firstPartner = uniquePartners.values().next().value as Partner | undefined;

  return {
    answer,
    intent: "contact_lookup",
    empty: false,
    partnerId: firstPartner?.id ?? null,
    matchedPartner: firstPartner
      ? {
          id: firstPartner.id,
          name: firstPartner.company_name,
          href: `/dashboard/partners/${firstPartner.id}?tab=organization`
        }
      : null,
    partners: [...uniquePartners.values()].map((partner) => ({
      id: partner.id,
      name: partner.company_name,
      href: `/dashboard/partners/${partner.id}`
    })),
    contacts,
    items,
    sources: [{ type: "partner_contacts", label: "인력/담당자 DB" }],
    matchStrategy: "exact",
    menuLinks: firstPartner
      ? [
          {
            label: "파트너 상세",
            href: `/dashboard/partners/${firstPartner.id}?tab=organization`
          }
        ]
      : [{ label: "인력·담당자", href: "/dashboard/contacts" }]
  };
}

export function appendTrainingForPerson(
  result: SearchResult,
  hits: PartnerContact[],
  context: SearchContext
): SearchResult {
  const names = new Set(hits.map((hit) => normalizePersonName(hit.name)));
  const partnerIds = new Set(hits.map((hit) => hit.partner_id));
  const rows = context.attendances.filter((row) => {
    if (!row.attended) return false;
    const nameOk = row.attendee_name ? names.has(normalizePersonName(row.attendee_name)) : false;
    const contactOk = row.contact_id ? hits.some((hit) => hit.id === row.contact_id) : false;
    const partnerOk = !!row.partner_id && partnerIds.has(row.partner_id);
    return (nameOk || contactOk) && partnerOk;
  });
  if (rows.length === 0) {
    return {
      ...result,
      answer: `${result.answer}\n\n교육: 현재 등록된 데이터에서 확인되지 않습니다.`,
      intent: "training_lookup"
    };
  }
  const lines = rows
    .slice(0, 8)
    .map(
      (row) =>
        `- ${row.training_name} (${row.training_year ?? "-"}-${String(row.training_month ?? "").padStart(2, "0")})`
    );
  return {
    ...result,
    answer: `${result.answer}\n\n교육 참석:\n${lines.join("\n")}`,
    intent: "training_lookup",
    items: [
      ...result.items,
      ...rows.slice(0, 8).map((row) => ({
        id: row.id,
        title: row.training_name,
        subtitle: row.attendee_name ?? "",
        href: `/dashboard/partners/${row.partner_id}?tab=trainings`
      }))
    ],
    menuLinks: [
      ...(result.menuLinks ?? []),
      { label: "교육 현황", href: "/dashboard/trainings" }
    ]
  };
}

export function resolveExactSearchResult(
  query: string,
  context: SearchContext
): SearchResult | null {
  const detected = detectQueryEntities(query);

  if (detected.emails[0]) {
    return buildContactSearchResult(findContactsByEmail(detected.emails[0], context), context, {
      query
    });
  }
  if (detected.phones[0]) {
    return buildContactSearchResult(findContactsByPhone(detected.phones[0], context), context, {
      query
    });
  }
  if (detected.businessNumbers[0]) {
    const digits = detected.businessNumbers[0].replace(/\D/g, "");
    const partner = context.partners.find(
      (row) => (row.business_number ?? "").replace(/\D/g, "") === digits
    );
    if (!partner) return null;
    return null;
  }

  const leftover = leftoverQueryTokens(query);
  const split = splitCompanyPersonRemainder(leftover, context);
  const partnerId = split.partnerId;

  if (detected.surnamePrefix && (partnerId || queryHasContactHint(query))) {
    const hits = findContactsBySurnamePrefix(detected.surnamePrefix, context, partnerId);
    if (hits.length > 0) {
      return buildContactSearchResult(hits, context, { ambiguousName: detected.surnamePrefix, query });
    }
  }

  if (split.personToken) {
    const hits = findContactsByPersonName(split.personToken, context, partnerId);
    if (hits.length === 0 && queryHasContactHint(query)) {
      return buildContactSearchResult([], context, { query });
    }
    if (hits.length === 0) return null;
    const chosen = filterByRoleHint(hits, query);
    let result = buildContactSearchResult(chosen, context, {
      ambiguousName: chosen.length > 1 ? split.personToken : undefined,
      query
    });
    if (queryHasTrainingHint(query)) {
      result = appendTrainingForPerson(result, chosen, context);
    }
    return result;
  }

  if (partnerId && (queryHasContactHint(query) || queryHasSalesRoleHint(query) || queryHasEngineerRoleHint(query))) {
    let hits = context.contacts.filter(
      (contact) => isCanonicalContact(contact) && contact.partner_id === partnerId
    );
    hits = filterByRoleHint(hits, query);
    return buildContactSearchResult(hits, context, { query });
  }

  if (leftover.length === 1 && /^[가-힣]{2,5}$/.test(leftover[0]!)) {
    const hits = findContactsByPersonName(leftover[0]!, context);
    if (hits.length > 0) {
      return buildContactSearchResult(hits, context, {
        ambiguousName: hits.length > 1 ? leftover[0] : undefined,
        query
      });
    }
  }

  return null;
}
