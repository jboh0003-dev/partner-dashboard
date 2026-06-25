import type { CourseTag } from "@/lib/trainings/course-tags";

export type SearchIntent =
  | "partner_profile"
  | "asset_lookup"
  | "document_lookup"
  | "contact_lookup"
  | "training_lookup"
  | "recent_contracts"
  | "contract_month_lookup"
  | "contract_year_lookup"
  | "date_condition_lookup"
  | "policy_lookup"
  | "event_lookup"
  | "general_knowledge_lookup"
  | "missing_document_lookup"
  | "asset_partner_list"
  | "training_gap_lookup";

export type SearchListColumn = {
  key: string;
  label: string;
};

export type SearchListRow = {
  id: string;
  href?: string;
  values: Record<string, string>;
};

export type SearchListResult = {
  title: string;
  criteria: string;
  totalCount: number;
  columns: SearchListColumn[];
  rows: SearchListRow[];
  exportFilename: string;
};

export type SearchMatchStrategy =
  | "exact"
  | "alias"
  | "includes"
  | "fuzzy"
  | "none"
  | "ambiguous"
  | "low_confidence";

export type SearchSource = {
  type:
    | "partner"
    | "partner_contacts"
    | "training_attendance"
    | "trainings"
    | "partner_assets"
    | "partner_documents"
    | "partner_pocs"
    | "partner_knowledge"
    | "partner_notes"
    | "partner_events"
    | "recruitment";
  label: string;
  updatedAt?: string | null;
};

export type SearchPartnerLink = {
  id: string;
  name: string;
  href: string;
};

export type SearchContactItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  position?: string | null;
  partnerId: string;
  partnerName: string;
};

export type SearchResultItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href?: string;
  downloadHref?: string;
  /** 정책/가이드/메모 설명 카드 */
  kind?: "data" | "policy" | "guide" | "note" | "event";
};

export type SearchFollowUpQuery = {
  label: string;
  query: string;
};

export type SearchMenuLink = {
  label: string;
  href: string;
};

export type SearchSummaryCard = {
  label: string;
  value: string;
};

export type ParsedSearchQuery = {
  raw: string;
  intent: SearchIntent;
  companyCandidate: string | null;
  requiresPartner: boolean;
  grade: string | null;
  months: string[];
  attendedTags: CourseTag[];
  notAttendedTags: CourseTag[];
  documentTypeFilter: string | null;
  /** 복수 문서 유형 모두 등록 조건 */
  requiredDocumentTypes: string[];
  /** 계약일 조건 (년) */
  contractYear: number | null;
  /** 계약일 조건 (월, 1-12) */
  contractMonth: number | null;
  /** 장비 보유 조건 (기간/등급 목록 조회 시) */
  requiresAssets: boolean;
  /** 지식베이스 카테고리 힌트 */
  knowledgeCategory: string | null;
  /** 행사 연도 필터 */
  eventYear: number | null;
};

export type SearchResult = {
  answer: string;
  criteria?: string;
  intent: SearchIntent;
  /** 조건/기간/리스트 조회용 테이블 */
  listResult?: SearchListResult;
  empty: boolean;
  needsClarification?: boolean;
  /** 정책/가이드형 설명 응답 */
  explanationStyle?: boolean;
  /** contact_lookup 등 특정 파트너 기준 조회 시 연결 파트너 ID */
  partnerId?: string | null;
  matchedPartner: SearchPartnerLink | null;
  partners: SearchPartnerLink[];
  contacts: SearchContactItem[];
  items: SearchResultItem[];
  sources: SearchSource[];
  matchStrategy: SearchMatchStrategy;
  confidence?: number;
  emptyGuidance?: string;
  followUpQueries?: SearchFollowUpQuery[];
  summaryCards?: SearchSummaryCard[];
  menuLinks?: SearchMenuLink[];
};
