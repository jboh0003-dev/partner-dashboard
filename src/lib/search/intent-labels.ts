import type { SearchIntent } from "@/lib/search/types";

/** UI·응답에 표시할 질문 유형 라벨 */
export const SEARCH_INTENT_LABEL: Record<SearchIntent, string> = {
  recent_contracts: "최근 계약 파트너",
  contract_month_lookup: "월별 계약 파트너",
  contract_year_lookup: "연도별 계약 파트너",
  date_condition_lookup: "조건별 계약 파트너",
  missing_document_lookup: "문서 미등록 파트너",
  asset_partner_list: "장비 보유 파트너",
  policy_lookup: "파트너 정책",
  event_lookup: "행사 자료",
  general_knowledge_lookup: "정책·가이드",
  training_gap_lookup: "교육 미수강 파트너",
  partner_profile: "파트너 프로필",
  asset_lookup: "파트너 장비",
  document_lookup: "파트너 문서",
  contact_lookup: "파트너 담당자",
  training_lookup: "파트너 교육"
};

const LIST_INTENTS_WITHOUT_PARTNER = new Set<SearchIntent>([
  "recent_contracts",
  "contract_month_lookup",
  "contract_year_lookup",
  "date_condition_lookup",
  "missing_document_lookup",
  "asset_partner_list",
  "training_gap_lookup",
  "policy_lookup",
  "event_lookup",
  "general_knowledge_lookup"
]);

export function isListIntentWithoutPartner(intent: SearchIntent): boolean {
  return LIST_INTENTS_WITHOUT_PARTNER.has(intent);
}

export function isPartnerRequiredIntent(intent: SearchIntent): boolean {
  return !isListIntentWithoutPartner(intent);
}

export function getSearchIntentLabel(intent: SearchIntent): string {
  return SEARCH_INTENT_LABEL[intent] ?? intent;
}
