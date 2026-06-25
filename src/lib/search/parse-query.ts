import { COURSE_TAGS, type CourseTag } from "@/lib/trainings/course-tags";
import { yearMonthKey } from "@/lib/training-display";
import { stripNonPartnerTerms } from "@/lib/search/company-terms";
import { compactSearchQuery, normalizeSearchQuery } from "@/lib/search/query-normalize";
import type { ParsedSearchQuery, SearchIntent } from "@/lib/search/types";
import type { Training } from "@/types/training";

const LIST_INTENTS = new Set<SearchIntent>([
  "recent_contracts",
  "contract_month_lookup",
  "contract_year_lookup",
  "missing_document_lookup",
  "asset_partner_list",
  "training_gap_lookup",
  "date_condition_lookup",
  "policy_lookup",
  "event_lookup",
  "general_knowledge_lookup"
]);

const INTENT_KEYWORDS: Record<
  Exclude<
    SearchIntent,
    | "partner_profile"
    | "policy_lookup"
    | "event_lookup"
    | "general_knowledge_lookup"
    | "recent_contracts"
    | "contract_month_lookup"
    | "contract_year_lookup"
    | "date_condition_lookup"
    | "missing_document_lookup"
    | "asset_partner_list"
    | "training_gap_lookup"
  >,
  string[]
> = {
  asset_lookup: [
    "장비",
    "서버",
    "스펙",
    "리소스",
    "infra",
    "hw",
    "hardware",
    "노드",
    "컴퓨터",
    "장비규격"
  ],
  contact_lookup: ["담당자", "연락처", "메일", "이메일", "인력", "담당"],
  training_lookup: ["교육", "수강", "참석", "이수", "들었", "수료", "정기교육"],
  document_lookup: [
    "문서",
    "파일",
    "제안서",
    "계약서",
    "신청서",
    "사업자등록",
    "사업자등록증",
    "회사소개",
    "회사소개서",
    "통장",
    "은행계좌",
    "계좌",
    "신용평가",
    "신용평가서",
    "보고서",
    "등록 여부"
  ]
};

const STOP_WORDS = [
  "조회",
  "확인",
  "보여",
  "보여주",
  "알려",
  "알려줘",
  "해주",
  "해 주",
  "해줘",
  "해 주세요",
  "주세요",
  "부탁",
  "좀",
  "현황",
  "목록",
  "리스트",
  "정보",
  "관련",
  "대상",
  "파트너",
  "파트너사",
  "회사",
  "업체",
  "특정",
  "해당"
];

const GRADE_ALIASES: Record<string, string> = {
  플래티넘: "platinum",
  platinum: "platinum",
  골드: "gold",
  gold: "gold",
  실버: "silver",
  silver: "silver",
  전략: "strategic",
  strategic: "strategic"
};

const DOCUMENT_TYPE_KEYWORDS: Record<string, string[]> = {
  partner_contract: ["계약서", "파트너계약", "파트너 계약"],
  partner_application: ["신청서", "파트너신청", "파트너 신청"],
  business_registration: ["사업자등록", "사업자 등록", "사업자등록증"],
  company_profile: ["회사소개", "회사소개서", "소개서"],
  bank_account: ["통장", "은행계좌", "은행 계좌", "계좌사본"],
  credit_rating: ["신용평가", "신용 평가", "신용평가서"]
};

function countIntentHits(query: string, keywords: string[]): number {
  const lower = query.toLowerCase();
  return keywords.reduce((count, keyword) => {
    return lower.includes(keyword.toLowerCase()) ? count + 1 : count;
  }, 0);
}

function isRegisteredDocumentListQuery(query: string, requiredTypes: string[]): boolean {
  if (requiredTypes.length < 2) return false;
  const lower = query.toLowerCase();
  return (
    /(모두|둘|전부|와|과).*(등록|등록된)/.test(lower) ||
    /등록된.*파트너.*(만|조회|보여|알려)/.test(lower)
  );
}

function isMissingDocumentListQuery(query: string): boolean {
  const lower = query.toLowerCase();
  const compact = compactSearchQuery(query);
  if (isRegisteredDocumentListQuery(query, parseAllDocumentTypes(query))) return false;
  const docTypes =
    "계약서|신청서|사업자등록|사업자등록증|통장|통장사본|은행계좌|신용평가|신용평가서|회사소개|문서";
  return (
    new RegExp(`(${docTypes}).*(미등록|없|등록되지|누락|미보유|안)`, "i").test(lower) ||
    new RegExp(`(미등록|없는|없음|등록되지|없는).*(계약서|신청서|사업자|통장|신용|문서|파트너)`, "i").test(
      lower
    ) ||
    /문서\s*미등록/.test(lower) ||
    /계약서.*(없|미등록|없음|없는|누락)/.test(compact) ||
    /(없|미등록|없음|없는).*(계약서|신청서|문서)/.test(compact) ||
    /계약서없/.test(compact) ||
    /계약서없는파트너/.test(compact)
  );
}

export function isRecentContractsQuery(query: string): boolean {
  const compact = compactSearchQuery(query);
  const lower = query.toLowerCase();

  if (parseContractPeriod(query)?.month) return false;
  if (/(\d{1,2})\s*월/.test(query) && /(계약|신규)/.test(lower) && !/최근/.test(lower)) {
    return false;
  }
  if (/(20\d{2}|\d{2}\s*년)/.test(query) && /(계약|신규)/.test(lower) && !/최근/.test(compact)) {
    return false;
  }

  return (
    /최근.*(계약|등록|신규).*(파트너|회사|업체)/.test(compact) ||
    /(신규|최근).*(계약|등록).*(파트너|목록|알려|보여|조회|리스트)/.test(compact) ||
    (/최근계약/.test(compact) && /파트너/.test(compact)) ||
    /최근.*신규.*파트너/.test(compact) ||
    /최근.*등록.*파트너/.test(compact) ||
    /최근계약한?파트너/.test(compact) ||
    /최근.*계약.*파트너/.test(compact)
  );
}

export function isContractMonthLookupQuery(query: string): boolean {
  const period = parseContractPeriod(query);
  return period != null && period.month != null && /(계약|신규)/.test(query.toLowerCase());
}

export function isContractYearLookupQuery(query: string): boolean {
  const lower = query.toLowerCase();
  if (isRecentContractsQuery(query)) return false;
  const period = parseContractPeriod(query);
  if (period?.month) return false;
  if (/작년|지난\s*해|올해|이번\s*해/.test(lower) && /(계약|신규)/.test(lower)) return true;
  return period != null && /(계약|신규)/.test(lower);
}

function isAssetPartnerListQuery(query: string): boolean {
  const lower = query.toLowerCase();
  const compact = compactSearchQuery(query);
  if (isDateConditionLookupQuery(query)) return false;
  if (/(20\d{2}|\d{1,2}월)/.test(query) && /(계약|신규)/.test(lower) && !/장비/.test(compact)) {
    return false;
  }
  return (
    /장비.*(보유|있|등록).*(파트너|회사|업체)/.test(compact) ||
    /(파트너|회사|업체).*(장비).*(보유|있|등록)/.test(compact) ||
    (/장비/.test(compact) &&
      /(보유|있는|있음|목록|보여|조회)/.test(compact) &&
      /(파트너|회사|업체)/.test(compact)) ||
    (/장비/.test(lower) &&
      /(보유|있는|목록|보여)/.test(lower) &&
      /(파트너|회사|업체)/.test(lower) &&
      !/특정/.test(lower))
  );
}

function isTrainingGapLookupQuery(query: string): boolean {
  const lower = query.toLowerCase();
  const gapKeywords = [
    "모객",
    "미참석",
    "미수강",
    "안 들",
    "안들",
    "수강 안",
    "참석 안",
    "교육 안",
    "교육 미수강",
    "미수강 파트너"
  ];
  return (
    gapKeywords.some((keyword) => lower.includes(keyword)) ||
    /(\d{1,2})\s*월.*(안|미)/.test(query) ||
    /(교육|수강|참석).*(미|안)/.test(lower) ||
    /(미수강|미참석).*(파트너|회사)/.test(lower)
  );
}

export function isDateConditionLookupQuery(query: string): boolean {
  const lower = query.toLowerCase();
  const hasDate =
    /(20\d{2}|\d{2}\s*년|\d{1,2}\s*월|올해|이번\s*해|계약일)/.test(query) ||
    /올해|이번\s*해/.test(lower);
  const hasContract = /(계약|신규)/.test(lower);
  const hasPartnerList = /(파트너|회사|업체|목록|알려|보여|조회|찾)/.test(lower);
  const isPolicyQuestion = /(기준|정책|뭐|어떻)/.test(lower) && !hasPartnerList;
  if (isPolicyQuestion) return false;
  return hasDate && hasContract && hasPartnerList;
}

function isPolicyLookupQuery(query: string): boolean {
  const lower = query.toLowerCase();
  const compact = compactSearchQuery(query);
  if (isDateConditionLookupQuery(query)) return false;
  if (isEventLookupQuery(query)) return false;
  if (isRegisteredDocumentListQuery(query, parseAllDocumentTypes(query))) return false;

  const barePolicy =
    /^파트너\s*정책\s*$/.test(lower.trim()) ||
    /파트너\s*정책/.test(lower) ||
    /파트너정책/.test(compact) ||
    /파트너\s*승급\s*기준/.test(lower) ||
    /^승급\s*기준/.test(lower.trim()) ||
    /파트너\s*신청.*(문서|서류|필요)/.test(lower);

  const asksPolicy =
    barePolicy ||
    /(정책|기준|혜택|승급|등급|플래티넘|골드|실버|운영\s*기준|필요한\s*문서|제출\s*서류|계약.*기준|교육.*기준|등록\s*기준)/.test(
      lower
    );
  const isQuestion = /(\?|뭐|어떻|알려|설명|무엇)/.test(lower) || barePolicy;
  const asksDataList =
    /(파트너를\s*알려|파트너사를|보여줘|목록|찾아줘|찾아\s*줘)/.test(lower) &&
    !/(기준|정책|뭐|어떻)/.test(lower);

  if (asksDataList) return false;
  if (/정책설명회|킥오프/.test(lower.replace(/\s+/g, ""))) return false;
  return asksPolicy && isQuestion;
}

export function isEventLookupQuery(query: string): boolean {
  const compact = query.toLowerCase().replace(/\s+/g, "");
  const hasEventKeyword =
    /파트너데이|파트너day|세미나|간담회|솔루션데이|정책설명회|킥오프|행사/.test(compact);
  const hasEventAction =
    /(자료|목록|보여|찾|뭐였|관련|알려)/.test(compact) ||
    /행사목록/.test(compact) ||
    /년.*행사/.test(compact);

  if (!hasEventKeyword) return false;
  return hasEventAction || /년.*행사|행사.*목록|파트너데이|세미나|간담회/.test(compact);
}

function isGeneralKnowledgeLookupQuery(query: string): boolean {
  const lower = query.toLowerCase();
  if (isPolicyLookupQuery(query) || isEventLookupQuery(query)) return false;
  return /(faq|가이드|자주\s*묻|도움말|메모|히스토리|기록|이력|코멘트)/.test(lower);
}

export function parseContractPeriod(
  query: string
): { year: number; month: number | null } | null {
  const currentYear = new Date().getFullYear();
  const lower = query.toLowerCase();

  if (/올해|이번\s*해/.test(lower)) {
    const monthMatch = query.match(/(\d{1,2})\s*월/);
    return {
      year: currentYear,
      month: monthMatch ? Number(monthMatch[1]) : null
    };
  }

  if (/작년|지난\s*해/.test(lower)) {
    const monthMatch = query.match(/(\d{1,2})\s*월/);
    return {
      year: currentYear - 1,
      month: monthMatch ? Number(monthMatch[1]) : null
    };
  }

  const full = query.match(/(20\d{2})\s*년?\s*(\d{1,2})\s*월/);
  if (full) return { year: Number(full[1]), month: Number(full[2]) };

  const short = query.match(/(?:^|\s)(\d{2})\s*년?\s*(\d{1,2})\s*월/);
  if (short) return { year: 2000 + Number(short[1]), month: Number(short[2]) };

  const yearOnly = query.match(/(20\d{2})\s*년/);
  if (yearOnly && /(계약|신규)/.test(lower)) {
    return { year: Number(yearOnly[1]), month: null };
  }

  return null;
}

function parseKnowledgeCategory(query: string): string | null {
  const lower = query.toLowerCase();
  if (/(정책|policy)/.test(lower)) return "정책";
  if (/(faq|가이드)/.test(lower)) return "FAQ";
  if (/(운영|기준|담당자)/.test(lower)) return "운영기준";
  if (/(계약|서류|신청)/.test(lower)) return "계약";
  if (/(등급|승급|플래티넘|골드)/.test(lower)) return "등급";
  if (/(교육|수강)/.test(lower)) return "교육";
  if (/(행사|세미나|간담회)/.test(lower)) return "행사";
  return null;
}

/** 조건·목록형 질문 intent (파트너명 불필요) */
export function inferListIntentFromQuery(query: string): SearchIntent | null {
  const normalized = normalizeSearchQuery(query) || query.trim();
  const requiredTypes = parseAllDocumentTypes(normalized);

  if (isRegisteredDocumentListQuery(normalized, requiredTypes)) return "missing_document_lookup";
  if (isMissingDocumentListQuery(normalized)) return "missing_document_lookup";
  if (isRecentContractsQuery(normalized)) return "recent_contracts";
  if (isContractMonthLookupQuery(normalized)) return "contract_month_lookup";
  if (isContractYearLookupQuery(normalized)) return "contract_year_lookup";
  if (isDateConditionLookupQuery(normalized)) return "date_condition_lookup";
  if (isEventLookupQuery(normalized)) return "event_lookup";
  if (isPolicyLookupQuery(normalized)) return "policy_lookup";
  if (isGeneralKnowledgeLookupQuery(normalized)) return "general_knowledge_lookup";
  if (isTrainingGapLookupQuery(normalized)) return "training_gap_lookup";
  if (isAssetPartnerListQuery(normalized)) return "asset_partner_list";
  return null;
}

export function classifyIntent(query: string): SearchIntent {
  const normalized = normalizeSearchQuery(query) || query.trim();
  const listIntent = inferListIntentFromQuery(query);
  if (listIntent) return listIntent;

  const scores = (Object.keys(INTENT_KEYWORDS) as Array<keyof typeof INTENT_KEYWORDS>)
    .map((intent) => ({
      intent,
      score: countIntentHits(normalized, INTENT_KEYWORDS[intent])
    }))
    .sort((a, b) => b.score - a.score);

  if (scores[0]?.score > 0) {
    const top = scores[0].intent;
    if (top === "document_lookup" && isPolicyLookupQuery(normalized)) return "policy_lookup";
    if (top === "document_lookup" && isMissingDocumentListQuery(normalized)) {
      return "missing_document_lookup";
    }
    return top;
  }
  return "partner_profile";
}

function parseGrade(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [alias, grade] of Object.entries(GRADE_ALIASES)) {
    if (lower.includes(alias.toLowerCase())) return grade;
  }
  return null;
}

function parseMonths(query: string, trainings: Training[]): string[] {
  const currentYear = new Date().getFullYear();
  const yearMatch = query.match(/(20\d{2})\s*년/);
  const explicitYear = yearMatch ? Number(yearMatch[1]) : null;

  const yearsFromData = Array.from(
    new Set(
      trainings
        .map((training) => training.training_year)
        .filter((year): year is number => typeof year === "number")
    )
  ).sort((a, b) => b - a);

  const defaultYear = explicitYear ?? yearsFromData[0] ?? currentYear;
  const matches = [...query.matchAll(/(\d{1,2})\s*월/g)];
  const months = new Set<string>();

  for (const match of matches) {
    const month = Number(match[1]);
    if (month < 1 || month > 12) continue;
    months.add(yearMonthKey(defaultYear, month));
  }

  return Array.from(months);
}

function parseCourseTags(query: string): {
  attended: CourseTag[];
  notAttended: CourseTag[];
} {
  const upper = query.toUpperCase();
  const attended = new Set<CourseTag>();
  const notAttended = new Set<CourseTag>();

  for (const tag of COURSE_TAGS) {
    if (tag === "기타") continue;
    const tagUpper = tag.toUpperCase();
    if (!upper.includes(tagUpper)) continue;

    const notPattern = new RegExp(
      `${tagUpper}[^\\n]{0,24}(안\\s*들|미수강|미참석|안들)`,
      "i"
    );
    const attendedPattern = new RegExp(
      `${tagUpper}[^\\n]{0,24}(들었|수강|이수|참석)`,
      "i"
    );

    if (notPattern.test(upper)) {
      notAttended.add(tag);
    } else if (attendedPattern.test(upper)) {
      attended.add(tag);
    }
  }

  return {
    attended: Array.from(attended),
    notAttended: Array.from(notAttended)
  };
}

function stripIntentWords(query: string): string {
  let text = stripNonPartnerTerms(query);

  const allKeywords = [
    ...Object.values(INTENT_KEYWORDS).flat(),
    ...STOP_WORDS,
    ...Object.keys(GRADE_ALIASES),
    ...COURSE_TAGS,
    "platinum",
    "gold",
    "silver",
    "strategic",
    "정책",
    "기준",
    "승급",
    "가이드",
    "faq"
  ];

  for (const keyword of allKeywords.sort((a, b) => b.length - a.length)) {
    text = text.replace(new RegExp(keyword, "gi"), " ");
  }

  text = text.replace(/20\d{2}\s*년/g, " ");
  text = text.replace(/\d{1,2}\s*월/g, " ");
  text = text.replace(/[^\p{L}\p{N}\s]/gu, " ");
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function parseDocumentTypeFilter(query: string): string | null {
  const types = parseAllDocumentTypes(query);
  return types.length === 1 ? types[0] : null;
}

export function parseAllDocumentTypes(query: string): string[] {
  const lower = query.toLowerCase();
  const found: string[] = [];
  for (const [documentType, keywords] of Object.entries(DOCUMENT_TYPE_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
      found.push(documentType);
    }
  }
  return found;
}

function queryRequiresAssets(query: string): boolean {
  return /장비/.test(query.toLowerCase()) && /(보유|있|등록)/.test(query.toLowerCase());
}

export function buildFollowUpQuery(
  partnerName: string,
  parsed: Pick<ParsedSearchQuery, "intent" | "raw" | "months">
): string {
  const intentPhrase: Record<SearchIntent, string> = {
    asset_lookup: "장비 보유 현황",
    document_lookup: "문서 등록 현황",
    contact_lookup: "담당자 연락처",
    training_lookup: "교육 참석 현황",
    training_gap_lookup: "교육 미수강 파트너",
    asset_partner_list: "장비 보유 파트너",
    missing_document_lookup: "계약서 미등록 파트너",
    partner_profile: "기본 정보",
    recent_contracts: "최근 계약 파트너",
    contract_month_lookup: "계약 파트너",
    contract_year_lookup: "계약 파트너",
    date_condition_lookup: "계약 파트너",
    policy_lookup: "파트너 정책",
    event_lookup: "행사 자료",
    general_knowledge_lookup: "가이드/FAQ"
  };

  const monthLabel = parsed.raw.match(/\d{1,2}\s*월/g)?.join(" ") ?? "";
  return [partnerName, monthLabel, intentPhrase[parsed.intent]].filter(Boolean).join(" ");
}

const LIST_INTENTS_EXPORT = LIST_INTENTS;

export function isListSearchIntent(intent: SearchIntent): boolean {
  return LIST_INTENTS_EXPORT.has(intent);
}

export function parseSearchQuery(query: string, trainings: Training[]): ParsedSearchQuery {
  const raw = query.trim();
  const normalized = normalizeSearchQuery(raw) || raw;
  const intent = classifyIntent(raw);
  const grade = parseGrade(raw);
  const months = parseMonths(raw, trainings);
  const { attended, notAttended } = parseCourseTags(raw);
  const requiredDocumentTypes = parseAllDocumentTypes(raw);
  const documentTypeFilter = parseDocumentTypeFilter(raw);
  const contractPeriod = parseContractPeriod(raw);
  const eventYearMatch = raw.match(/(20\d{2})\s*년/);
  const eventYear = eventYearMatch
    ? Number(eventYearMatch[1])
    : raw.match(/(?:^|\s)(\d{2})\s*년/)
      ? 2000 + Number(raw.match(/(?:^|\s)(\d{2})\s*년/)![1])
      : null;
  const requiresPartner = !LIST_INTENTS.has(intent);
  const companyCandidate = requiresPartner ? stripIntentWords(normalized) || null : null;

  return {
    raw,
    intent,
    companyCandidate: requiresPartner ? companyCandidate : null,
    requiresPartner,
    grade,
    months,
    attendedTags: attended,
    notAttendedTags: notAttended,
    documentTypeFilter,
    requiredDocumentTypes,
    contractYear: contractPeriod?.year ?? null,
    contractMonth: contractPeriod?.month ?? null,
    requiresAssets: queryRequiresAssets(raw),
    knowledgeCategory: parseKnowledgeCategory(raw),
    eventYear
  };
}

export function isRegisteredDocumentListMode(parsed: ParsedSearchQuery): boolean {
  return (
    parsed.requiredDocumentTypes.length >= 2 &&
    isRegisteredDocumentListQuery(parsed.raw, parsed.requiredDocumentTypes)
  );
}
