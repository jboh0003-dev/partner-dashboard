import { PARTNER_GRADE_LABEL, DOCUMENT_TYPE_LABEL } from "@/lib/constants";
import { formatAssetUpdatedAt } from "@/lib/assets/display";
import { normalizeAssetNodeName, sortAssetsByNodeOrder } from "@/lib/assets/node-utils";
import {
  fetchSearchContext,
  formatContactRole,
  latestTimestamp,
  type SearchContext
} from "@/lib/data/search";
import { extractCompanyCandidateFromQuery } from "@/lib/search/extract-company";
import { resolveCompanyName } from "@/lib/search/fuzzy-company";
import { stripNonPartnerTerms } from "@/lib/search/company-terms";
import { isPipelineQuery } from "@/lib/search/pipeline-query";
import { handlePipelineLookup } from "@/lib/search/pipeline-lookup-handler";
import { buildFollowUpQuery, inferListIntentFromQuery, isRegisteredDocumentListMode, parseSearchQuery } from "@/lib/search/parse-query";
import {
  getDefaultKnowledgeRows,
  policyChunksToKnowledgeRows,
  searchPartnerKnowledge,
  type KnowledgeSearchHit,
  type PartnerKnowledgeRow
} from "@/lib/search/knowledge";
import { searchPartnerEvents, wantsEventAllFiles } from "@/lib/search/event-search";
import { EVENT_DOCUMENT_TYPE_LABEL } from "@/lib/events/event-document-types";
import { OKE_NO_KNOWLEDGE, OKE_POLICY_NOT_FOUND } from "@/lib/search/oke-branding";
import type {
  ParsedSearchQuery,
  SearchContactItem,
  SearchIntent,
  SearchListResult,
  SearchMenuLink,
  SearchPartnerLink,
  SearchResult,
  SearchResultItem,
  SearchSource,
  SearchSummaryCard
} from "@/lib/search/types";
import { buildRecruitmentRows } from "@/lib/trainings/recruitment";
import { formatTrainingYearMonth } from "@/lib/training-display";
import { formatDate } from "@/lib/utils";
import type { Partner, PartnerContact } from "@/types/partner";

const NO_DATA_ANSWER = "조회 가능한 데이터가 없습니다. 등록 여부를 확인해 주세요.";
const EMPTY_LIST_ANSWER = "조건에 맞는 데이터가 없습니다.";
const PARTNER_NOT_FOUND_ANSWER =
  "등록된 파트너사에서 일치하는 대상을 찾지 못했습니다.";
const RECENT_CONTRACT_LIMIT = 10;

function partnerLink(partner: { id: string; company_name: string }): SearchPartnerLink {
  return {
    id: partner.id,
    name: partner.company_name,
    href: `/dashboard/partners/${partner.id}`
  };
}

function partnerDetailMenu(partnerId: string, tab?: string): SearchMenuLink[] {
  const suffix = tab ? `?tab=${tab}` : "";
  return [
    {
      label: "파트너 상세",
      href: `/dashboard/partners/${partnerId}${suffix}`
    }
  ];
}

function resolveCompany(parsed: ParsedSearchQuery, context: SearchContext) {
  const candidate =
    extractCompanyCandidateFromQuery(
      parsed.raw,
      context.partners,
      parsed.companyCandidate
    ) ?? parsed.companyCandidate;

  return resolveCompanyName(candidate, context.partners);
}

function contactsForPartner(
  partnerId: string,
  partnerName: string,
  contacts: PartnerContact[]
): SearchContactItem[] {
  return contacts
    .filter((contact) => contact.partner_id === partnerId)
    .map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      role: formatContactRole(contact.role_type),
      position: contact.position,
      partnerId,
      partnerName
    }));
}

function resolvePrimaryContacts(
  partnerId: string,
  partnerName: string,
  contacts: PartnerContact[]
): SearchContactItem[] {
  const partnerContacts = contacts.filter((contact) => contact.partner_id === partnerId);
  const prioritized = [
    partnerContacts.find((contact) => contact.is_contract_contact),
    partnerContacts.find((contact) => contact.is_primary),
    partnerContacts.find((contact) => contact.role_type === "sales"),
    partnerContacts[0]
  ].filter(Boolean) as PartnerContact[];

  const unique = new Map<string, PartnerContact>();
  for (const contact of prioritized) unique.set(contact.id, contact);

  return Array.from(unique.values()).map((contact) => ({
    id: contact.id,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    role: formatContactRole(contact.role_type),
    position: contact.position,
    partnerId,
    partnerName
  }));
}

function clarificationResult(
  parsed: ParsedSearchQuery,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult {
  const candidates = match.candidates.slice(0, 5);
  return {
    answer: PARTNER_NOT_FOUND_ANSWER,
    intent: parsed.intent,
    empty: true,
    needsClarification: true,
    matchedPartner: null,
    partners: candidates.map(partnerLink),
    contacts: [],
    items: candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.company_name,
      href: `/dashboard/partners/${candidate.id}`
    })),
    sources: [{ type: "partner", label: "partners" }],
    matchStrategy: match.strategy,
    confidence: match.confidence,
    followUpQueries:
      candidates.length > 0
        ? candidates.map((candidate) => ({
            label: candidate.company_name,
            query: buildFollowUpQuery(candidate.company_name, parsed)
          }))
        : undefined
  };
}

function ambiguousCompany(
  candidates: Array<{ id: string; company_name: string }>,
  parsed: ParsedSearchQuery,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult {
  return {
    answer:
      "유사한 파트너사명이 여러 건 확인되었습니다. 조회 대상 파트너사를 선택해 주세요.",
    intent: parsed.intent,
    empty: false,
    needsClarification: true,
    matchedPartner: null,
    partners: candidates.map(partnerLink),
    contacts: [],
    items: candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.company_name,
      href: `/dashboard/partners/${candidate.id}`
    })),
    sources: [{ type: "partner", label: "partners" }],
    matchStrategy: match.strategy,
    confidence: match.confidence,
    followUpQueries: candidates.map((candidate) => ({
      label: candidate.company_name,
      query: buildFollowUpQuery(candidate.company_name, parsed)
    }))
  };
}

function requirePartnerMatch(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult | null {
  if (!parsed.requiresPartner) return null;

  if (match.strategy === "ambiguous") {
    return ambiguousCompany(match.candidates, parsed, match);
  }

  if (
    match.strategy === "low_confidence" ||
    match.strategy === "none" ||
    !match.partner
  ) {
    return clarificationResult(parsed, match);
  }

  return null;
}

function handleAssetLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult {
  const blocked = requirePartnerMatch(parsed, context, match);
  if (blocked) return blocked;

  const partner = match.partner!;
  const assets = sortAssetsByNodeOrder(
    context.assets.filter((asset) => asset.partner_id === partner.id)
  );
  const updatedAt = latestTimestamp(
    assets.map((asset) => asset.updated_at ?? asset.last_synced_at ?? asset.created_at)
  );
  const sources: SearchSource[] = [
    { type: "partner_assets", label: "장비/리소스 DB", updatedAt },
    { type: "partner", label: "partners" }
  ];
  const menuLinks = [
    ...partnerDetailMenu(partner.id, "assets"),
    { label: "장비/리소스 목록", href: "/dashboard/assets" }
  ];

  if (assets.length === 0) {
    return {
      answer: NO_DATA_ANSWER,
      intent: "asset_lookup",
      empty: true,
      matchedPartner: partnerLink(partner),
      partners: [partnerLink(partner)],
      contacts: [],
      items: [],
      sources,
      matchStrategy: match.strategy,
      confidence: match.confidence,
      menuLinks,
      summaryCards: [
        { label: "조회 대상", value: partner.company_name },
        { label: "보유 장비", value: "0건" }
      ]
    };
  }

  const items: SearchResultItem[] = assets.map((asset) => {
    const nodeLabel =
      normalizeAssetNodeName(asset.node_name) ??
      asset.node_name ??
      asset.asset_name ??
      "장비";
    const quantity = asset.quantity != null ? `${asset.quantity}식` : "1식";
    return {
      id: asset.id,
      title: nodeLabel,
      subtitle: [
        `보유: 등록됨`,
        `장비 구분: ${asset.asset_group ?? asset.node_type ?? asset.asset_type ?? "-"}`,
        `수량: ${quantity}`
      ].join(" · "),
      meta: asset.memo?.trim() || asset.spec_summary?.trim() || undefined,
      href: `/dashboard/partners/${partner.id}?tab=assets`
    };
  });

  return {
    answer: `${partner.company_name}의 장비/리소스 현황입니다.`,
    intent: "asset_lookup",
    empty: false,
    matchedPartner: partnerLink(partner),
    partners: [partnerLink(partner)],
    contacts: [],
    items,
    sources,
    matchStrategy: match.strategy,
    confidence: match.confidence,
    menuLinks,
    summaryCards: [
      { label: "조회 대상", value: partner.company_name },
      { label: "등록 장비", value: `${assets.length}건` },
      {
        label: "최종 반영",
        value: updatedAt ? formatDate(updatedAt) : "-"
      }
    ]
  };
}

function knowledgeRows(
  context: SearchContext,
  options?: { policyOnly?: boolean }
): PartnerKnowledgeRow[] {
  const policyRows =
    context.policyDocument && context.policyChunks.length > 0
      ? policyChunksToKnowledgeRows(context.policyDocument, context.policyChunks)
      : [];

  const legacyRows =
    context.knowledge.length > 0 ? context.knowledge : getDefaultKnowledgeRows();

  if (options?.policyOnly) {
    return policyRows.length > 0 ? policyRows : legacyRows;
  }

  if (policyRows.length > 0) return [...policyRows, ...legacyRows];
  return legacyRows;
}

function isPolicyVersionComparisonQuery(query: string): boolean {
  return /이전\s*버전|변경\s*(전|후)|비교|달라|차이|old|previous/.test(query.toLowerCase());
}

function extractSlideNumbers(hits: KnowledgeSearchHit[]): number[] {
  const slides = new Set<number>();
  for (const hit of hits) {
    const match = hit.content.match(/\[슬라이드\s*(\d+)\]/);
    if (match) slides.add(Number(match[1]));
  }
  return [...slides].sort((left, right) => left - right);
}

function stripSlidePrefix(content: string): string {
  return content.replace(/^\[슬라이드\s*\d+\]\s*/, "").trim();
}

function formatPolicyKnowledgeAnswer(
  hits: KnowledgeSearchHit[],
  document: SearchContext["policyDocument"]
): string {
  const body = hits
    .slice(0, 3)
    .map((hit) => stripSlidePrefix(hit.content))
    .filter(Boolean)
    .join("\n\n");
  const trimmed = body.length > 700 ? `${body.slice(0, 700)}…` : body;
  const slides = extractSlideNumbers(hits);
  const slideRef = slides.length > 0 ? ` (근거: 슬라이드 ${slides.join(", ")})` : "";

  if (document) {
    return `${document.version_label} 정책(기준일 ${document.effective_date}) 기준으로 ${trimmed}${slideRef}`;
  }

  return `${trimmed}${slideRef}`;
}

function partnerMatchesContractDate(
  partner: Partner,
  year: number | null,
  month: number | null
): boolean {
  if (!partner.contract_start_date) return false;
  const date = new Date(partner.contract_start_date);
  if (Number.isNaN(date.getTime())) return false;
  if (year != null && date.getFullYear() !== year) return false;
  if (month != null && date.getMonth() + 1 !== month) return false;
  return true;
}

function sortPartnersByContractDate(partners: Partner[]): Partner[] {
  return [...partners].sort((left, right) => {
    const leftTime = left.contract_start_date
      ? new Date(left.contract_start_date).getTime()
      : 0;
    const rightTime = right.contract_start_date
      ? new Date(right.contract_start_date).getTime()
      : 0;
    return rightTime - leftTime;
  });
}

function formatContractContact(
  partnerId: string,
  partnerName: string,
  contacts: PartnerContact[]
): string {
  const primary = resolvePrimaryContacts(partnerId, partnerName, contacts)[0];
  if (!primary) return "-";
  return [primary.name, primary.phone, primary.email].filter(Boolean).join(" · ") || primary.name;
}

function buildPartnerTableListResult(
  partners: Partner[],
  context: SearchContext,
  options: {
    title: string;
    criteria: string;
    exportFilename: string;
    includeContractDate?: boolean;
    subtitleForPartner?: (partner: Partner) => string;
  }
): SearchListResult {
  const columns = [
    { key: "company", label: "파트너사" },
    { key: "grade", label: "등급" },
    ...(options.includeContractDate !== false
      ? [{ key: "contractDate", label: "계약일자" }]
      : []),
    { key: "contact", label: "계약담당자" },
    { key: "detail", label: "상세" }
  ];

  const rows = partners.map((partner) => ({
    id: partner.id,
    href: `/dashboard/partners/${partner.id}`,
    values: {
      company: partner.company_name,
      grade: PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? partner.grade ?? "-",
      ...(options.includeContractDate !== false
        ? {
            contractDate: partner.contract_start_date
              ? formatDate(partner.contract_start_date)
              : "-"
          }
        : {}),
      contact: formatContractContact(partner.id, partner.company_name, context.contacts),
      detail: "상세 보기"
    }
  }));

  return {
    title: options.title,
    criteria: options.criteria,
    totalCount: partners.length,
    columns,
    rows,
    exportFilename: options.exportFilename
  };
}

function partnerListItems(
  partners: Partner[],
  context: SearchContext,
  subtitleForPartner?: (partner: Partner) => string
): SearchResultItem[] {
  return partners.map((partner) => ({
    id: partner.id,
    title: partner.company_name,
    subtitle:
      subtitleForPartner?.(partner) ??
      [
        `등급: ${PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? partner.grade ?? "-"}`,
        partner.contract_start_date
          ? `계약일: ${formatDate(partner.contract_start_date)}`
          : null,
        `담당: ${formatContractContact(partner.id, partner.company_name, context.contacts)}`
      ]
        .filter(Boolean)
        .join(" · "),
    href: `/dashboard/partners/${partner.id}`
  }));
}

function emptyListResult(
  parsed: ParsedSearchQuery,
  options: {
    intent: SearchIntent;
    criteria: string;
    title: string;
    menuLinks?: SearchMenuLink[];
    summaryCards?: SearchSummaryCard[];
  }
): SearchResult {
  return {
    answer: EMPTY_LIST_ANSWER,
    criteria: options.criteria,
    intent: options.intent,
    empty: true,
    matchedPartner: null,
    partners: [],
    contacts: [],
    items: [],
    sources: [{ type: "partner", label: "partners" }],
    matchStrategy: "none",
    menuLinks: options.menuLinks,
    summaryCards: options.summaryCards ?? [
      { label: "조회 기준", value: options.criteria },
      { label: "총 건수", value: "0건" }
    ],
    listResult: {
      title: options.title,
      criteria: options.criteria,
      totalCount: 0,
      columns: [
        { key: "company", label: "파트너사" },
        { key: "grade", label: "등급" },
        { key: "contractDate", label: "계약일자" },
        { key: "contact", label: "계약담당자" },
        { key: "detail", label: "상세" }
      ],
      rows: [],
      exportFilename: "oke-search"
    }
  };
}

function listSearchResult(
  parsed: ParsedSearchQuery,
  options: {
    intent: SearchIntent;
    answer: string;
    criteria: string;
    title: string;
    partners: Partner[];
    context: SearchContext;
    exportFilename: string;
    menuLinks?: SearchMenuLink[];
    includeContractDate?: boolean;
    subtitleForPartner?: (partner: Partner) => string;
    sources?: SearchSource[];
  }
): SearchResult {
  const listResult = buildPartnerTableListResult(options.partners, options.context, {
    title: options.title,
    criteria: options.criteria,
    exportFilename: options.exportFilename,
    includeContractDate: options.includeContractDate,
    subtitleForPartner: options.subtitleForPartner
  });

  return {
    answer: options.answer,
    criteria: options.criteria,
    intent: options.intent,
    empty: options.partners.length === 0,
    matchedPartner: null,
    partners: options.partners.map(partnerLink),
    contacts: [],
    items: partnerListItems(options.partners, options.context, options.subtitleForPartner),
    sources: options.sources ?? [{ type: "partner", label: "partners" }],
    matchStrategy: "none",
    menuLinks: options.menuLinks,
    summaryCards: [
      { label: "조회 기준", value: options.criteria },
      { label: "총 건수", value: `${options.partners.length}건` }
    ],
    listResult
  };
}

function handleRecentContracts(
  parsed: ParsedSearchQuery,
  context: SearchContext
): SearchResult {
  const criteria = "계약일자 최신순";
  const title = "최근 계약 파트너";
  const partners = sortPartnersByContractDate(
    context.partners.filter((partner) => partner.contract_start_date)
  ).slice(0, RECENT_CONTRACT_LIMIT);

  if (partners.length === 0) {
    return emptyListResult(parsed, {
      intent: "recent_contracts",
      criteria,
      title
    });
  }

  return listSearchResult(parsed, {
    intent: "recent_contracts",
    answer: "최근 계약 파트너를 조회했습니다.",
    criteria,
    title,
    partners,
    context,
    exportFilename: "recent-contract-partners"
  });
}

function handleContractPeriodLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  intent: "contract_month_lookup" | "contract_year_lookup" | "date_condition_lookup"
): SearchResult {
  let partners = context.partners.filter((partner) =>
    partnerMatchesContractDate(partner, parsed.contractYear, parsed.contractMonth)
  );

  if (parsed.grade) {
    partners = partners.filter((partner) => (partner.grade ?? "none") === parsed.grade);
  }

  if (parsed.requiresAssets) {
    const assetPartnerIds = new Set(context.assets.map((asset) => asset.partner_id));
    partners = partners.filter((partner) => assetPartnerIds.has(partner.id));
  }

  const periodParts: string[] = [];
  if (parsed.contractYear) periodParts.push(`${parsed.contractYear}년`);
  if (parsed.contractMonth) periodParts.push(`${parsed.contractMonth}월`);
  const periodLabel = periodParts.length > 0 ? periodParts.join(" ") : "조건";
  const gradeLabel = parsed.grade
    ? `${PARTNER_GRADE_LABEL[parsed.grade] ?? parsed.grade} `
    : "";
  const assetLabel = parsed.requiresAssets ? "장비 보유 " : "";
  const criteria =
    intent === "contract_month_lookup"
      ? `${periodLabel} 계약일 기준`
      : intent === "contract_year_lookup"
        ? `${periodLabel} 계약일 기준`
        : `${periodLabel} ${gradeLabel}${assetLabel}계약 조건`.trim();
  const title = `${periodLabel} 계약 파트너`.trim();

  const updatedAt = latestTimestamp(
    partners.map((partner) => partner.updated_at ?? partner.created_at)
  );
  const sources: SearchSource[] = [{ type: "partner", label: "partners", updatedAt }];
  if (parsed.requiresAssets) {
    sources.unshift({
      type: "partner_assets",
      label: "장비/리소스 DB",
      updatedAt: latestTimestamp(
        context.assets.map((asset) => asset.updated_at ?? asset.created_at)
      )
    });
  }

  if (partners.length === 0) {
    return {
      ...emptyListResult(parsed, {
        intent,
        criteria,
        title,
        summaryCards: [{ label: "조회 조건", value: criteria }]
      }),
      sources
    };
  }

  return {
    ...listSearchResult(parsed, {
      intent,
      answer: `${title} ${partners.length}곳입니다.`,
      criteria,
      title,
      partners: sortPartnersByContractDate(partners),
      context,
      exportFilename: "contract-partners",
      sources
    })
  };
}

function handleKnowledgeLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  intent: "policy_lookup"
): SearchResult {
  const rows = knowledgeRows(context, { policyOnly: true });
  let hits = searchPartnerKnowledge(parsed.raw, rows, 5);
  const criteria = context.policyDocument
    ? `${context.policyDocument.version_label} · 기준일 ${context.policyDocument.effective_date}`
    : "파트너 정책·가이드 검색";

  if (parsed.knowledgeCategory) {
    hits = hits.filter((hit) => hit.category === parsed.knowledgeCategory);
    if (hits.length === 0) {
      hits = searchPartnerKnowledge(parsed.raw, rows, 5);
    }
  }

  const isComparison = isPolicyVersionComparisonQuery(parsed.raw);
  let comparisonNote = "";
  if (
    isComparison &&
    context.previousPolicyDocument &&
    context.previousPolicyChunks.length > 0
  ) {
    const previousRows = policyChunksToKnowledgeRows(
      context.previousPolicyDocument,
      context.previousPolicyChunks
    );
    const previousHits = searchPartnerKnowledge(parsed.raw, previousRows, 3);
    if (previousHits.length > 0) {
      comparisonNote = `\n\n[이전 버전: ${context.previousPolicyDocument.version_label} · 기준일 ${context.previousPolicyDocument.effective_date}]\n${formatPolicyKnowledgeAnswer(previousHits, context.previousPolicyDocument)}`;
    }
  }

  const updatedAt = latestTimestamp([
    context.policyDocument?.updated_at,
    ...hits.map((hit) => hit.updated_at)
  ]);
  const sources: SearchSource[] = [
    {
      type: "partner_knowledge",
      label: context.policyDocument
        ? `정책 ${context.policyDocument.version_label}`
        : "정책·가이드 DB",
      updatedAt
    },
    { type: "partner", label: "partners" }
  ];
  const menuLinks: SearchMenuLink[] = [{ label: "파트너 정책", href: "/dashboard/policy" }];

  if (hits.length === 0) {
    return {
      answer: context.policyDocument ? OKE_POLICY_NOT_FOUND : OKE_NO_KNOWLEDGE,
      criteria,
      intent,
      empty: true,
      explanationStyle: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources,
      matchStrategy: "none",
      menuLinks
    };
  }

  const top = hits[0];
  const categoryLabel = hits.map((hit) => hit.category).filter(Boolean).slice(0, 3).join(", ");
  const items: SearchResultItem[] = hits.map((hit) => ({
    id: hit.id,
    title: hit.title,
    subtitle: hit.content.length > 200 ? `${hit.content.slice(0, 200)}…` : hit.content,
    meta: [hit.category, hit.source].filter(Boolean).join(" · "),
    kind: "policy"
  }));

  return {
    answer: `${formatPolicyKnowledgeAnswer(hits, context.policyDocument)}${comparisonNote}`,
    criteria,
    intent,
    empty: false,
    explanationStyle: true,
    matchedPartner: null,
    partners: [],
    contacts: [],
    items,
    sources,
    matchStrategy: "none",
    menuLinks,
    summaryCards: [
      { label: "근거", value: categoryLabel || top.category },
      {
        label: "출처",
        value: context.policyDocument?.version_label ?? top.source ?? "등록된 정책·가이드"
      },
      { label: "관련 항목", value: `${hits.length}건` }
    ]
  };
}

function handleGeneralKnowledgeLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult {
  const isNoteQuery = /(메모|히스토리|기록|이력|코멘트)/.test(parsed.raw.toLowerCase());

  if (isNoteQuery) {
    return handleNoteLookup(parsed, context, match);
  }

  const rows = knowledgeRows(context);
  let hits = searchPartnerKnowledge(parsed.raw, rows, 5);
  const faqHits = hits.filter((hit) => hit.category === "FAQ");
  if (faqHits.length > 0) hits = faqHits;

  const updatedAt = latestTimestamp(hits.map((hit) => hit.updated_at));
  const sources: SearchSource[] = [
    { type: "partner_knowledge", label: "정책·가이드 DB", updatedAt }
  ];
  const menuLinks: SearchMenuLink[] = [
    { label: "파트너 정책", href: "/dashboard/policy" }
  ];

  if (hits.length === 0) {
    return {
      answer: OKE_NO_KNOWLEDGE,
      intent: "general_knowledge_lookup",
      empty: true,
      explanationStyle: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources,
      matchStrategy: "none",
      menuLinks
    };
  }

  const top = hits[0];
  const items: SearchResultItem[] = hits.map((hit) => ({
    id: hit.id,
    title: hit.title,
    subtitle: hit.content.length > 200 ? `${hit.content.slice(0, 200)}…` : hit.content,
    meta: [hit.category, hit.source].filter(Boolean).join(" · "),
    kind: "guide"
  }));

  return {
    answer: top.content.length > 280 ? `${top.content.slice(0, 280)}…` : top.content,
    intent: "general_knowledge_lookup",
    empty: false,
    explanationStyle: true,
    matchedPartner: null,
    partners: [],
    contacts: [],
    items,
    sources,
    matchStrategy: "none",
    menuLinks,
    summaryCards: [
      { label: "근거", value: top.category },
      { label: "출처", value: top.source ?? "등록된 가이드" },
      { label: "관련 항목", value: `${hits.length}건` }
    ]
  };
}

function handleEventLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext
): SearchResult {
  let hits = searchPartnerEvents(parsed.raw, context.events, context.eventDocuments, 10);

  if (parsed.eventYear) {
    const yearFiltered = hits.filter(
      (event) => event.year === parsed.eventYear || event.event_date?.startsWith(String(parsed.eventYear))
    );
    if (yearFiltered.length > 0) hits = yearFiltered;
  }

  const updatedAt = latestTimestamp(
    hits.flatMap((event) => [
      event.updated_at,
      ...event.documents.map((doc) => doc.uploaded_at)
    ])
  );
  const sources: SearchSource[] = [
    { type: "partner_events", label: "행사 DB", updatedAt }
  ];
  const menuLinks: SearchMenuLink[] = [{ label: "행사 현황", href: "/dashboard/events" }];
  const yearLabel = parsed.eventYear ? `${parsed.eventYear}년 ` : "";
  const criteria = `${yearLabel}행사 자료 검색`.trim();

  if (hits.length === 0) {
    return {
      answer: EMPTY_LIST_ANSWER,
      criteria,
      intent: "event_lookup",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources,
      matchStrategy: "none",
      menuLinks
    };
  }

  const isListQuery = /목록|리스트/.test(parsed.raw);
  const showAllFiles = wantsEventAllFiles(parsed.raw);
  const top = hits[0];
  const topDate = top.event_date;

  menuLinks.push({
    label: `${top.event_name} 상세 보기`,
    href: `/dashboard/events/${top.id}`
  });

  if (showAllFiles && top.allDocumentCount > top.documents.length) {
    menuLinks.push({
      label: "전체 파일 보기",
      href: `/dashboard/events/${top.id}#documents`
    });
  }

  const items: SearchResultItem[] = hits.flatMap((event) => {
    const eventDate = event.event_date;
    const eventItem: SearchResultItem = {
      id: event.id,
      title: event.event_name,
      subtitle: [
        event.event_type,
        eventDate ? formatDate(eventDate) : null,
        event.summary
      ]
        .filter(Boolean)
        .join(" · "),
      meta: event.description ?? undefined,
      href: `/dashboard/events/${event.id}`,
      kind: "event"
    };

    const docItems = event.documents.slice(0, 5).map((doc) => ({
      id: doc.id,
      title: doc.display_name,
      subtitle: [
        doc.document_type
          ? EVENT_DOCUMENT_TYPE_LABEL[doc.document_type as keyof typeof EVENT_DOCUMENT_TYPE_LABEL] ??
            doc.document_type
          : null,
        doc.original_file_name
      ]
        .filter(Boolean)
        .join(" · "),
      meta: `등록 ${formatDate(doc.uploaded_at)}`,
      href: `/dashboard/events/${event.id}#documents`,
      kind: "event" as const
    }));

    return [eventItem, ...docItems];
  });

  const representativeDocs = top.documents.filter(
    (doc) => doc.is_representative || doc.file_status === "representative"
  );
  const docSummary =
    representativeDocs.length > 0
      ? representativeDocs.map((doc) => doc.display_name).join(", ")
      : top.documents.length > 0
        ? top.documents.map((doc) => doc.display_name).join(", ")
        : "등록된 대표 자료 없음";

  const answerParts = isListQuery
    ? [`${parsed.eventYear ? `${parsed.eventYear}년 ` : ""}공개 등록 행사 ${hits.length}건입니다.`]
    : [
        `${top.event_name} (${top.event_type ?? "-"})`,
        topDate ? `일자 ${formatDate(topDate)}` : null,
        top.summary,
        `대표 자료: ${docSummary}`
      ].filter(Boolean);

  if (showAllFiles && top.allDocumentCount > top.documents.length) {
    answerParts.push(
      `전체 파일 ${top.allDocumentCount}건은 행사 상세 > 전체 파일 보기에서 확인할 수 있습니다.`
    );
  }

  const answer = answerParts.join(" · ");

  return {
    answer,
    criteria,
    intent: "event_lookup",
    empty: false,
    matchedPartner: null,
    partners: [],
    contacts: [],
    items: items.slice(0, 12),
    sources,
    matchStrategy: "none",
    menuLinks,
    summaryCards: [
      { label: "행사", value: top.event_name },
      { label: "유형", value: top.event_type ?? "-" },
      { label: "일자", value: topDate ? formatDate(topDate) : "-" },
      { label: "자료", value: `${top.allDocumentCount}건` }
    ]
  };
}

function handleNoteLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult {
  const updatedAt = latestTimestamp(context.notes.map((note) => note.created_at));
  const sources: SearchSource[] = [
    { type: "partner_notes", label: "파트너 메모", updatedAt },
    { type: "partner", label: "partners" }
  ];

  if (parsed.requiresPartner) {
    const blocked = requirePartnerMatch(parsed, context, match);
    if (blocked) return blocked;

    const partner = match.partner!;
    const notes = context.notes.filter((note) => note.partner_id === partner.id);

    if (notes.length === 0) {
      return {
        answer: NO_DATA_ANSWER,
        intent: "general_knowledge_lookup",
        empty: true,
        matchedPartner: partnerLink(partner),
        partners: [partnerLink(partner)],
        contacts: [],
        items: [],
        sources,
        matchStrategy: match.strategy,
        confidence: match.confidence,
        menuLinks: partnerDetailMenu(partner.id)
      };
    }

    const items = notes.slice(0, 10).map((note) => ({
      id: note.id,
      title: note.title?.trim() || note.note_type || "메모",
      subtitle: note.content,
      meta: note.created_at ? `작성 ${formatDate(note.created_at)}` : undefined,
      href: `/dashboard/partners/${partner.id}`,
      kind: "note" as const
    }));

    return {
      answer: `${partner.company_name}의 등록 메모 ${notes.length}건입니다.`,
      intent: "general_knowledge_lookup",
      empty: false,
      matchedPartner: partnerLink(partner),
      partners: [partnerLink(partner)],
      contacts: [],
      items,
      sources,
      matchStrategy: match.strategy,
      confidence: match.confidence,
      menuLinks: partnerDetailMenu(partner.id),
      summaryCards: [{ label: "조회 대상", value: partner.company_name }]
    };
  }

  const tokens = parsed.raw
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  const partnerById = new Map(context.partners.map((partner) => [partner.id, partner]));
  const matchedNotes = context.notes.filter((note) => {
    const haystack = `${note.title ?? ""} ${note.content} ${note.note_type ?? ""}`.toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });

  if (matchedNotes.length === 0) {
    return {
      answer: NO_DATA_ANSWER,
      intent: "general_knowledge_lookup",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources,
      matchStrategy: "none"
    };
  }

  const items = matchedNotes.slice(0, 10).map((note) => {
    const partner = partnerById.get(note.partner_id);
    return {
      id: note.id,
      title: note.title?.trim() || "메모",
      subtitle: note.content,
      meta: partner ? `${partner.company_name} · ${formatDate(note.created_at)}` : undefined,
      href: partner ? `/dashboard/partners/${partner.id}` : undefined,
      kind: "note" as const
    };
  });

  return {
    answer: `키워드와 일치하는 메모 ${matchedNotes.length}건입니다.`,
    intent: "general_knowledge_lookup",
    empty: false,
    matchedPartner: null,
    partners: [],
    contacts: [],
    items,
    sources,
    matchStrategy: "none"
  };
}

function handleDateConditionLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext
): SearchResult {
  return handleContractPeriodLookup(parsed, context, "date_condition_lookup");
}

function handleRegisteredDocumentList(
  parsed: ParsedSearchQuery,
  context: SearchContext
): SearchResult {
  const types = parsed.requiredDocumentTypes;
  const typeLabels = types.map((type) => DOCUMENT_TYPE_LABEL[type] ?? type);

  let partners = context.partners.filter((partner) =>
    types.every((documentType) =>
      context.documents.some(
        (row) =>
          row.partner_id === partner.id &&
          !row.deleted_at &&
          row.document_type === documentType
      )
    )
  );

  if (parsed.grade) {
    partners = partners.filter((partner) => (partner.grade ?? "none") === parsed.grade);
  }

  const updatedAt = latestTimestamp(context.documents.map((row) => row.created_at));
  const sources: SearchSource[] = [
    { type: "partner_documents", label: "문서 DB", updatedAt },
    { type: "partner", label: "partners" }
  ];
  const conditionLabel = `${typeLabels.join(" + ")} 모두 등록`;
  const title = `${typeLabels.join(" + ")} 등록 파트너`;
  const criteria = conditionLabel;

  if (partners.length === 0) {
    return emptyListResult(parsed, {
      intent: "missing_document_lookup",
      criteria,
      title,
      menuLinks: [{ label: "문서 관리", href: "/dashboard/documents" }]
    });
  }

  const listResult: SearchListResult = {
    title,
    criteria,
    totalCount: partners.length,
    exportFilename: "registered-document-partners",
    columns: [
      { key: "company", label: "파트너사" },
      { key: "grade", label: "등급" },
      { key: "status", label: "등록 상태" },
      { key: "detail", label: "상세" }
    ],
    rows: partners.map((partner) => ({
      id: partner.id,
      href: `/dashboard/partners/${partner.id}?tab=documents`,
      values: {
        company: partner.company_name,
        grade: PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? partner.grade ?? "-",
        status: "등록 완료",
        detail: "상세 보기"
      }
    }))
  };

  const items = partners.map((partner) => ({
    id: partner.id,
    title: partner.company_name,
    subtitle: `${conditionLabel} · 등록 상태: 완료`,
    href: `/dashboard/partners/${partner.id}?tab=documents`
  }));

  return {
    answer: `${conditionLabel} 파트너사 ${partners.length}곳입니다.`,
    criteria,
    intent: "missing_document_lookup",
    empty: false,
    matchedPartner: null,
    partners: partners.map(partnerLink),
    contacts: [],
    items,
    sources,
    matchStrategy: "none",
    menuLinks: [{ label: "문서 관리", href: "/dashboard/documents" }],
    summaryCards: [
      { label: "조회 기준", value: criteria },
      { label: "총 건수", value: `${partners.length}건` }
    ],
    listResult
  };
}

function handleAssetPartnerList(
  parsed: ParsedSearchQuery,
  context: SearchContext
): SearchResult {
  const partnerIdsWithAssets = new Set(context.assets.map((asset) => asset.partner_id));
  let partners = context.partners.filter((partner) => partnerIdsWithAssets.has(partner.id));

  if (parsed.grade) {
    partners = partners.filter((partner) => (partner.grade ?? "none") === parsed.grade);
  }

  const updatedAt = latestTimestamp(
    context.assets.map((asset) => asset.updated_at ?? asset.last_synced_at ?? asset.created_at)
  );
  const sources: SearchSource[] = [
    { type: "partner_assets", label: "장비/리소스 DB", updatedAt },
    { type: "partner", label: "partners" }
  ];
  const gradeLabel = parsed.grade
    ? `${PARTNER_GRADE_LABEL[parsed.grade] ?? parsed.grade} `
    : "";
  const criteria = `${gradeLabel}장비 보유 파트너`.trim();
  const title = "장비 보유 파트너";

  if (partners.length === 0) {
    return emptyListResult(parsed, {
      intent: "asset_partner_list",
      criteria,
      title,
      menuLinks: [{ label: "장비/리소스 목록", href: "/dashboard/assets" }]
    });
  }

  const listResult: SearchListResult = {
    title,
    criteria,
    totalCount: partners.length,
    exportFilename: "asset-partners",
    columns: [
      { key: "company", label: "파트너사" },
      { key: "grade", label: "등급" },
      { key: "assetCount", label: "장비 건수" },
      { key: "contact", label: "계약담당자" },
      { key: "detail", label: "상세" }
    ],
    rows: partners.map((partner) => {
      const assetCount = context.assets.filter((asset) => asset.partner_id === partner.id).length;
      return {
        id: partner.id,
        href: `/dashboard/partners/${partner.id}?tab=assets`,
        values: {
          company: partner.company_name,
          grade: PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? partner.grade ?? "-",
          assetCount: `${assetCount}건`,
          contact: formatContractContact(partner.id, partner.company_name, context.contacts),
          detail: "상세 보기"
        }
      };
    })
  };

  const items = partners.map((partner) => {
    const assetCount = context.assets.filter((asset) => asset.partner_id === partner.id).length;
    return {
      id: partner.id,
      title: partner.company_name,
      subtitle: `보유: 등록됨 · 장비 ${assetCount}건`,
      href: `/dashboard/partners/${partner.id}?tab=assets`
    };
  });

  return {
    answer: `${gradeLabel}장비를 보유한 파트너사 ${partners.length}곳입니다.`,
    criteria,
    intent: "asset_partner_list",
    empty: false,
    matchedPartner: null,
    partners: partners.map(partnerLink),
    contacts: [],
    items,
    sources,
    matchStrategy: "none",
    menuLinks: [{ label: "장비/리소스 목록", href: "/dashboard/assets" }],
    summaryCards: [
      { label: "조회 기준", value: criteria },
      { label: "총 건수", value: `${partners.length}건` }
    ],
    listResult
  };
}

function handleDocumentLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult {
  const blocked = requirePartnerMatch(parsed, context, match);
  if (blocked) return blocked;

  const partner = match.partner!;
  let rows = context.documents.filter(
    (row) => row.partner_id === partner.id && !row.deleted_at
  );

  if (parsed.documentTypeFilter) {
    rows = rows.filter((row) => row.document_type === parsed.documentTypeFilter);
  }

  const typeLabel = parsed.documentTypeFilter
    ? DOCUMENT_TYPE_LABEL[parsed.documentTypeFilter] ?? parsed.documentTypeFilter
    : null;
  const updatedAt = latestTimestamp(rows.map((row) => row.created_at));
  const sources: SearchSource[] = [
    { type: "partner_documents", label: "문서 DB", updatedAt },
    { type: "partner", label: "partners" }
  ];
  const menuLinks = [
    ...partnerDetailMenu(partner.id, "documents"),
    { label: "문서 관리", href: "/dashboard/documents" }
  ];

  if (rows.length === 0) {
    const filterHint = typeLabel ? ` (${typeLabel})` : "";
    return {
      answer: NO_DATA_ANSWER,
      intent: "document_lookup",
      empty: true,
      matchedPartner: partnerLink(partner),
      partners: [partnerLink(partner)],
      contacts: [],
      items: [],
      sources,
      matchStrategy: match.strategy,
      confidence: match.confidence,
      menuLinks,
      summaryCards: [
        { label: "조회 대상", value: partner.company_name },
        { label: "문서 유형", value: typeLabel ?? "전체" },
        { label: "등록 상태", value: `미등록${filterHint}` }
      ]
    };
  }

  const items: SearchResultItem[] = rows.map((row) => ({
    id: row.id,
    title: row.display_name ?? row.original_filename ?? row.file_name,
    subtitle: [
      `문서 유형: ${row.document_type ? DOCUMENT_TYPE_LABEL[row.document_type] ?? row.document_type : "-"}`,
      "등록 상태: 등록됨"
    ].join(" · "),
    meta: `등록일 ${formatDate(row.created_at)}`,
    href: `/dashboard/partners/${partner.id}?tab=documents`,
    downloadHref: `/api/partners/documents/${row.id}/download`
  }));

  return {
    answer: `${partner.company_name}의 문서 등록 현황입니다.`,
    intent: "document_lookup",
    empty: false,
    matchedPartner: partnerLink(partner),
    partners: [partnerLink(partner)],
    contacts: [],
    items,
    sources,
    matchStrategy: match.strategy,
    confidence: match.confidence,
    menuLinks,
    summaryCards: [
      { label: "조회 대상", value: partner.company_name },
      { label: "문서 유형", value: typeLabel ?? "전체" },
      { label: "등록 건수", value: `${rows.length}건` }
    ]
  };
}

function handleMissingDocumentList(
  parsed: ParsedSearchQuery,
  context: SearchContext
): SearchResult {
  if (isRegisteredDocumentListMode(parsed)) {
    return handleRegisteredDocumentList(parsed, context);
  }

  const documentType = parsed.documentTypeFilter ?? "partner_contract";
  const typeLabel = DOCUMENT_TYPE_LABEL[documentType] ?? documentType;
  const partnersWithDoc = new Set(
    context.documents
      .filter((row) => !row.deleted_at && row.document_type === documentType)
      .map((row) => row.partner_id)
  );

  let partners = context.partners.filter((partner) => !partnersWithDoc.has(partner.id));
  if (parsed.grade) {
    partners = partners.filter((partner) => (partner.grade ?? "none") === parsed.grade);
  }

  const updatedAt = latestTimestamp(context.documents.map((row) => row.created_at));
  const sources: SearchSource[] = [
    { type: "partner_documents", label: "문서 DB", updatedAt },
    { type: "partner", label: "partners" }
  ];

  const criteria = `${typeLabel} 미등록`;
  const title = `${typeLabel} 미등록 파트너`;

  if (partners.length === 0) {
    return {
      answer: EMPTY_LIST_ANSWER,
      criteria,
      intent: "missing_document_lookup",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources,
      matchStrategy: "none",
      menuLinks: [{ label: "문서 관리", href: "/dashboard/documents" }],
      summaryCards: [
        { label: "조회 기준", value: criteria },
        { label: "총 건수", value: "0건" }
      ],
      listResult: {
        title,
        criteria,
        totalCount: 0,
        exportFilename: "missing-document-partners",
        columns: [
          { key: "company", label: "파트너사" },
          { key: "grade", label: "등급" },
          { key: "status", label: "등록 상태" },
          { key: "detail", label: "상세" }
        ],
        rows: []
      }
    };
  }

  const listResult: SearchListResult = {
    title,
    criteria,
    totalCount: partners.length,
    exportFilename: "missing-document-partners",
    columns: [
      { key: "company", label: "파트너사" },
      { key: "grade", label: "등급" },
      { key: "status", label: "등록 상태" },
      { key: "detail", label: "상세" }
    ],
    rows: partners.map((partner) => ({
      id: partner.id,
      href: `/dashboard/partners/${partner.id}?tab=documents`,
      values: {
        company: partner.company_name,
        grade: PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? partner.grade ?? "-",
        status: "미등록",
        detail: "상세 보기"
      }
    }))
  };

  const items = partners.map((partner) => ({
    id: partner.id,
    title: partner.company_name,
    subtitle: `문서 유형: ${typeLabel} · 등록 상태: 미등록`,
    href: `/dashboard/partners/${partner.id}?tab=documents`
  }));

  return {
    answer: `${typeLabel}가 등록되지 않은 파트너사 ${partners.length}곳입니다.`,
    criteria,
    intent: "missing_document_lookup",
    empty: false,
    matchedPartner: null,
    partners: partners.map(partnerLink),
    contacts: [],
    items,
    sources,
    matchStrategy: "none",
    menuLinks: [{ label: "문서 관리", href: "/dashboard/documents" }],
    summaryCards: [
      { label: "조회 기준", value: criteria },
      { label: "총 건수", value: `${partners.length}건` }
    ],
    listResult
  };
}

function handleContactLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult {
  const blocked = requirePartnerMatch(parsed, context, match);
  if (blocked) return blocked;

  const partner = match.partner!;
  const contacts = contactsForPartner(partner.id, partner.company_name, context.contacts);
  const updatedAt = latestTimestamp(
    context.contacts
      .filter((contact) => contact.partner_id === partner.id)
      .map((contact) => contact.last_synced_at ?? contact.created_at)
  );
  const sources: SearchSource[] = [
    { type: "partner_contacts", label: "인력/담당자 DB", updatedAt },
    { type: "partner", label: "partners" }
  ];
  const menuLinks = [
    ...partnerDetailMenu(partner.id, "organization"),
    {
      label: `${partner.company_name} 담당자 보기`,
      href: `/dashboard/contacts?partnerId=${partner.id}`
    }
  ];

  if (contacts.length === 0) {
    return {
      answer: NO_DATA_ANSWER,
      intent: "contact_lookup",
      empty: true,
      partnerId: partner.id,
      matchedPartner: partnerLink(partner),
      partners: [partnerLink(partner)],
      contacts: [],
      items: [],
      sources,
      matchStrategy: match.strategy,
      confidence: match.confidence,
      menuLinks,
      summaryCards: [{ label: "조회 대상", value: partner.company_name }]
    };
  }

  const items = contacts.map((contact) => ({
    id: contact.id,
    title: contact.name,
    subtitle: [
      contact.position ? `직급: ${contact.position}` : null,
      contact.role ? `역할: ${contact.role}` : null,
      contact.phone ? `연락처: ${contact.phone}` : null,
      contact.email ? `이메일: ${contact.email}` : null
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/dashboard/partners/${partner.id}?tab=organization`
  }));

  return {
    answer: `${partner.company_name}의 담당자 정보입니다.`,
    intent: "contact_lookup",
    empty: false,
    partnerId: partner.id,
    matchedPartner: partnerLink(partner),
    partners: [partnerLink(partner)],
    contacts,
    items,
    sources,
    matchStrategy: match.strategy,
    confidence: match.confidence,
    menuLinks,
    summaryCards: [
      { label: "조회 대상", value: partner.company_name },
      { label: "담당자 수", value: `${contacts.length}명` }
    ]
  };
}

function handleTrainingLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult {
  const blocked = requirePartnerMatch(parsed, context, match);
  if (blocked) return blocked;

  const partner = match.partner!;
  let rows = context.attendances.filter((row) => row.partner_id === partner.id);

  if (parsed.months.length > 0) {
    rows = rows.filter((row) => {
      const key = `${row.training_year}-${String(row.training_month).padStart(2, "0")}`;
      return parsed.months.includes(key);
    });
  }

  const attendedRows = rows.filter((row) => row.attended);
  const updatedAt = latestTimestamp(rows.map((row) => row.created_at));
  const sources: SearchSource[] = [
    { type: "training_attendance", label: "교육 참석 DB", updatedAt },
    { type: "trainings", label: "trainings" },
    { type: "partner", label: "partners" }
  ];
  const menuLinks = [
    ...partnerDetailMenu(partner.id, "trainings"),
    { label: "교육 관리", href: "/dashboard/trainings" }
  ];

  const monthLabel =
    parsed.months.length > 0
      ? parsed.months
          .map((month) => {
            const [year, mon] = month.split("-");
            return formatTrainingYearMonth(Number(year), Number(mon));
          })
          .join(", ")
      : null;

  if (attendedRows.length === 0) {
    return {
      answer: NO_DATA_ANSWER,
      intent: "training_lookup",
      empty: true,
      matchedPartner: partnerLink(partner),
      partners: [partnerLink(partner)],
      contacts: [],
      items: [],
      sources,
      matchStrategy: match.strategy,
      confidence: match.confidence,
      menuLinks,
      summaryCards: [
        { label: "조회 대상", value: partner.company_name },
        { label: "교육 기간", value: monthLabel ?? "전체" }
      ]
    };
  }

  const items = attendedRows.map((row) => ({
    id: row.id,
    title: row.attendee_name?.trim() || "(이름 없음)",
    subtitle: [
      row.training_name,
      formatTrainingYearMonth(row.training_year, row.training_month),
      "참석: 완료"
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/dashboard/partners/${partner.id}?tab=trainings`
  }));

  const periodHint = monthLabel ? ` (${monthLabel})` : "";
  return {
    answer: `${partner.company_name}의 교육 참석 현황${periodHint}입니다.`,
    intent: "training_lookup",
    empty: false,
    matchedPartner: partnerLink(partner),
    partners: [partnerLink(partner)],
    contacts: [],
    items,
    sources,
    matchStrategy: match.strategy,
    confidence: match.confidence,
    menuLinks,
    summaryCards: [
      { label: "조회 대상", value: partner.company_name },
      { label: "교육 기간", value: monthLabel ?? "전체" },
      { label: "참석 건수", value: `${attendedRows.length}건` }
    ]
  };
}

function handleTechPartnerTrainingLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext
): SearchResult {
  const compact = parsed.raw.replace(/\s+/g, "");
  const wantsNoExam = /미응시/.test(parsed.raw);
  const wantsHighScore = /(점수|평균).*(높|상위)/.test(compact);

  let rows = context.attendances.filter(
    (row) =>
      /기술파트너/.test(row.training_name) || row.training_type === "기술파트너 교육"
  );

  const partnerMatch = resolveCompany(
    { ...parsed, requiresPartner: true, companyCandidate: extractCompanyCandidateFromQuery(parsed.raw, context.partners, null) },
    context
  );
  if (partnerMatch.partner) {
    rows = rows.filter((row) => row.partner_id === partnerMatch.partner!.id);
  } else {
    const mentioned = context.partners.find((partner) =>
      parsed.raw.toLowerCase().includes(partner.company_name.toLowerCase())
    );
    if (mentioned) {
      rows = rows.filter((row) => row.partner_id === mentioned.id);
    }
  }

  if (wantsNoExam) {
    rows = rows.filter(
      (row) => row.exam_status === "미응시" || row.exam_status === "결과없음" || row.exam_status === "매칭검토"
    );
  }

  if (wantsHighScore) {
    rows = [...rows].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }

  const criteria = partnerMatch.partner
    ? `${partnerMatch.partner.company_name} · 기술파트너 교육 결과`
    : wantsNoExam
      ? "기술파트너 교육 · 미응시/결과 없음"
      : "2026년 상반기 기술파트너 교육 결과";
  const title = "기술파트너 교육 결과";

  if (rows.length === 0) {
    return {
      ...emptyListResult(parsed, {
        intent: "tech_partner_training_lookup",
        criteria,
        title
      }),
      sources: [{ type: "training_attendance", label: "교육 참석 DB" }],
      menuLinks: [
        { label: "교육 현황", href: "/dashboard/trainings" },
        { label: "기술파트너 교육 업로드", href: "/dashboard/trainings/tech-partner-upload" }
      ]
    };
  }

  const listResult: SearchListResult = {
    title,
    criteria,
    totalCount: rows.length,
    exportFilename: "tech-partner-training-results",
    columns: [
      { key: "company", label: "파트너사" },
      { key: "name", label: "이름" },
      { key: "exam", label: "응시" },
      { key: "rank", label: "순위" },
      { key: "total", label: "총점" },
      { key: "converted", label: "환산" },
      { key: "detail", label: "상세" }
    ],
    rows: rows.map((row) => ({
      id: row.id,
      href: `/dashboard/partners/${row.partner_id}?tab=trainings`,
      values: {
        company: row.partner_name,
        name: row.attendee_name ?? "-",
        exam: row.exam_status ?? (row.score != null ? "응시" : "미응시"),
        rank: row.rank != null ? String(row.rank) : "-",
        total: row.score != null ? String(row.score) : "-",
        converted:
          row.converted_score != null ? String(row.converted_score) : "-",
        detail: "상세 보기"
      }
    }))
  };

  const avgScore =
    rows.filter((r) => r.score != null).length > 0
      ? Math.round(
          (rows.reduce((sum, r) => sum + (r.score ?? 0), 0) /
            rows.filter((r) => r.score != null).length) *
            10
        ) / 10
      : null;

  return {
    answer: partnerMatch.partner
      ? `${partnerMatch.partner.company_name} 기술파트너 교육 결과 ${rows.length}건입니다.`
      : `기술파트너 교육 결과 ${rows.length}건입니다.`,
    criteria,
    intent: "tech_partner_training_lookup",
    empty: false,
    matchedPartner: partnerMatch.partner ? partnerLink(partnerMatch.partner) : null,
    partners: Array.from(new Map(rows.map((r) => [r.partner_id, partnerLink({ id: r.partner_id, company_name: r.partner_name })])).values()),
    contacts: [],
    items: rows.slice(0, 10).map((row) => ({
      id: row.id,
      title: `${row.partner_name} · ${row.attendee_name ?? "-"}`,
      subtitle: [
        row.exam_status ?? (row.score != null ? "응시" : "미응시"),
        row.score != null ? `총점 ${row.score}` : null,
        row.converted_score != null ? `환산 ${row.converted_score}` : null
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/dashboard/partners/${row.partner_id}?tab=trainings`
    })),
    sources: [{ type: "training_attendance", label: "교육 참석 DB" }],
    matchStrategy: partnerMatch.strategy,
    confidence: partnerMatch.confidence,
    menuLinks: [
      { label: "교육 현황", href: "/dashboard/trainings" },
      { label: "기술파트너 교육 업로드", href: "/dashboard/trainings/tech-partner-upload" }
    ],
    summaryCards: [
      { label: "조회 기준", value: criteria },
      { label: "총 건수", value: `${rows.length}건` },
      { label: "평균 총점", value: avgScore != null ? String(avgScore) : "-" }
    ],
    listResult
  };
}

function handleTrainingGapLookup(
  parsed: ParsedSearchQuery,
  context: SearchContext
): SearchResult {
  const hasCourseTags =
    parsed.attendedTags.length > 0 || parsed.notAttendedTags.length > 0;
  const hasMonths = parsed.months.length > 0;

  if (!hasCourseTags && !hasMonths) {
    return {
      answer:
        "교육명 또는 연월을 더 구체적으로 입력해 주세요. 예: 5월 교육 미수강 파트너, Viola 교육 안 들은 파트너",
      criteria: "교육 미수강 조건",
      intent: "training_gap_lookup",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources: [{ type: "training_attendance", label: "교육 참석 DB" }],
      matchStrategy: "none",
      menuLinks: [{ label: "교육 관리", href: "/dashboard/trainings" }]
    };
  }

  const audience = hasCourseTags
    ? "course_tags"
    : hasMonths
      ? "month_absent"
      : "no_history";

  const rows = buildRecruitmentRows(
    {
      partners: context.partners,
      contacts: context.contacts,
      attendances: context.attendances.map((row) => ({
        partner_id: row.partner_id,
        training_id: row.training_id,
        attended: row.attended
      })),
      trainings: context.trainings
    },
    {
      audience,
      months: parsed.months,
      attended_tags: parsed.attendedTags,
      not_attended_tags: parsed.notAttendedTags,
      grade: parsed.grade ?? "all",
      contact_role: "all",
      q: undefined
    }
  );

  const updatedAt = latestTimestamp(context.attendances.map((row) => row.created_at));
  const sources: SearchSource[] = [
    { type: "recruitment", label: "교육 모객/미참석 분석" },
    { type: "training_attendance", label: "교육 참석 DB", updatedAt },
    { type: "partner", label: "partners" }
  ];

  const monthLabel =
    parsed.months.length > 0
      ? parsed.months
          .map((month) => {
            const [year, mon] = month.split("-");
            return formatTrainingYearMonth(Number(year), Number(mon));
          })
          .join(", ")
      : "전체";

  if (rows.length === 0) {
    return {
      answer: EMPTY_LIST_ANSWER,
      criteria: `교육 미수강 · ${monthLabel}`,
      intent: "training_gap_lookup",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources,
      matchStrategy: "none",
      menuLinks: [{ label: "교육 관리", href: "/dashboard/trainings" }],
      summaryCards: [
        { label: "교육 기간", value: monthLabel },
        { label: "조회 기준", value: "교육 미수강 파트너" }
      ]
    };
  }

  const contacts: SearchContactItem[] = rows
    .filter((row) => row.contactEmail || row.contactName)
    .map((row) => ({
      id: row.id,
      name: row.contactName ?? row.companyName,
      email: row.contactEmail,
      phone: row.contactPhone,
      role: row.contactRoleLabel,
      partnerId: row.partnerId,
      partnerName: row.companyName
    }));

  const items = rows.map((row) => ({
    id: row.id,
    title: row.companyName,
    subtitle: [
      row.gradeLabel,
      row.latestTrainingMonth ? `최근 교육 ${row.latestTrainingMonth}` : null,
      row.notAttendedCourseTags !== "-" ? `미수강: ${row.notAttendedCourseTags}` : null
    ]
      .filter(Boolean)
      .join(" · "),
    meta: row.contactName
      ? `담당: ${row.contactName}${row.contactEmail ? ` · ${row.contactEmail}` : ""}`
      : undefined,
    href: `/dashboard/partners/${row.partnerId}?tab=trainings`
  }));

  return {
    answer: `교육 미수강 대상 파트너사 ${rows.length}곳입니다.`,
    intent: "training_gap_lookup",
    empty: false,
    matchedPartner: null,
    partners: rows.map((row) => partnerLink({ id: row.partnerId, company_name: row.companyName })),
    contacts,
    items,
    sources,
    matchStrategy: "none",
    menuLinks: [{ label: "교육 관리", href: "/dashboard/trainings" }],
    summaryCards: [
      { label: "교육 기간", value: monthLabel },
      { label: "조회 결과", value: `${rows.length}곳` }
    ]
  };
}

function handlePartnerProfile(
  parsed: ParsedSearchQuery,
  context: SearchContext,
  match: ReturnType<typeof resolveCompanyName>
): SearchResult {
  const blocked = requirePartnerMatch(parsed, context, match);
  if (blocked) return blocked;

  const partner = context.partners.find((item) => item.id === match.partner!.id);
  if (!partner) return clarificationResult(parsed, match);

  const contacts = resolvePrimaryContacts(partner.id, partner.company_name, context.contacts);
  const sources: SearchSource[] = [{ type: "partner", label: "partners" }];

  return {
    answer: `${partner.company_name}의 파트너 운영 정보입니다.`,
    intent: "partner_profile",
    empty: false,
    matchedPartner: partnerLink(partner),
    partners: [partnerLink(partner)],
    contacts,
    items: [
      {
        id: partner.id,
        title: "파트너 등급",
        subtitle: PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? partner.grade ?? "-"
      },
      {
        id: `${partner.id}-contract`,
        title: "계약 시작일",
        subtitle: partner.contract_start_date ? formatDate(partner.contract_start_date) : "-"
      },
      {
        id: `${partner.id}-owner`,
        title: "영업 담당",
        subtitle: partner.sales_owner ?? "-"
      }
    ],
    sources,
    matchStrategy: match.strategy,
    confidence: match.confidence,
    menuLinks: partnerDetailMenu(partner.id),
    summaryCards: [
      { label: "파트너사", value: partner.company_name },
      {
        label: "등급",
        value: PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? partner.grade ?? "-"
      }
    ]
  };
}

export function runSearch(query: string, context: SearchContext): SearchResult {
  let parsed = parseSearchQuery(query, context.trainings);

  // Intent-first: 조건·목록·정책 질문은 파트너명 매칭 없이 처리
  if (parsed.intent === "partner_profile" || (parsed.requiresPartner && !parsed.companyCandidate?.trim())) {
    const listIntent = inferListIntentFromQuery(parsed.raw);
    if (listIntent) {
      parsed = {
        ...parsed,
        intent: listIntent,
        requiresPartner: false,
        companyCandidate: null
      };
    }
  }

  const match = parsed.requiresPartner
    ? resolveCompany(parsed, context)
    : {
        strategy: "none" as const,
        partner: null,
        candidates: [],
        confidence: 0,
        queryUsed: null
      };

  switch (parsed.intent) {
    case "policy_lookup":
      return handleKnowledgeLookup(parsed, context, "policy_lookup");
    case "general_knowledge_lookup":
      return handleGeneralKnowledgeLookup(parsed, context, match);
    case "event_lookup":
      return handleEventLookup(parsed, context);
    case "recent_contracts":
      return handleRecentContracts(parsed, context);
    case "contract_month_lookup":
      return handleContractPeriodLookup(parsed, context, "contract_month_lookup");
    case "contract_year_lookup":
      return handleContractPeriodLookup(parsed, context, "contract_year_lookup");
    case "date_condition_lookup":
      return handleDateConditionLookup(parsed, context);
    case "asset_partner_list":
      return handleAssetPartnerList(parsed, context);
    case "missing_document_lookup":
      return handleMissingDocumentList(parsed, context);
    case "training_gap_lookup":
      return handleTrainingGapLookup(parsed, context);
    case "tech_partner_training_lookup":
      return handleTechPartnerTrainingLookup(parsed, context);
    case "pipeline_lookup":
      return {
        intent: "pipeline_lookup",
        answer: "파이프라인 데이터를 조회합니다.",
        empty: true,
        matchedPartner: null,
        partners: [],
        contacts: [],
        items: [],
        sources: [{ type: "partner_knowledge", label: "파트너 파이프라인 DB" }],
        matchStrategy: "none",
        menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }]
      };
    case "asset_lookup":
      return handleAssetLookup(parsed, context, match);
    case "document_lookup":
      return handleDocumentLookup(parsed, context, match);
    case "contact_lookup":
      return handleContactLookup(parsed, context, match);
    case "training_lookup":
      return handleTrainingLookup(parsed, context, match);
    case "partner_profile":
    default:
      return handlePartnerProfile(parsed, context, match);
  }
}

export async function searchPartners(query: string): Promise<SearchResult> {
  const context = await fetchSearchContext();
  if (isPipelineQuery(query)) {
    const parsed = parseSearchQuery(query, context.trainings);
    const candidate = parsed.companyCandidate?.trim() || stripNonPartnerTerms(parsed.raw);
    const resolved = candidate
      ? resolveCompanyName(candidate, context.partners)
      : { partner: null, strategy: "none" as const, confidence: 0, candidates: [], queryUsed: null };
    return handlePipelineLookup(
      parsed,
      resolved.partner?.id ?? null,
      resolved.partner?.company_name ?? null
    );
  }
  return runSearch(query, context);
}
