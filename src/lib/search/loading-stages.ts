import { classifyIntent } from "@/lib/search/parse-query";
import type { SearchIntent } from "@/lib/search/types";

export type OkeLoadingStage = {
  id: string;
  label: string;
};

const BASE_STAGES: OkeLoadingStage[] = [
  { id: "analyze", label: "오케가 질문을 분석하고 있습니다." },
  { id: "classify", label: "조회 유형을 판단하고 있습니다." }
];

const DATA_STAGE: Record<string, OkeLoadingStage> = {
  partner: { id: "partner-db", label: "파트너 DB를 조회하고 있습니다." },
  filter: { id: "filter", label: "파트너 DB를 필터링하고 있습니다." },
  extract: { id: "extract", label: "조건 검색 기준을 추출하고 있습니다." },
  policy: { id: "policy", label: "정책/기준 데이터를 확인하고 있습니다." },
  document: { id: "document", label: "문서 등록 현황을 확인하고 있습니다." },
  event: { id: "event", label: "행사 자료를 검색하고 있습니다." },
  knowledge: { id: "knowledge", label: "문서/정책 데이터를 검색하고 있습니다." },
  training: { id: "training", label: "교육 데이터를 조회하고 있습니다." },
  asset: { id: "asset", label: "장비/리소스 DB를 조회하고 있습니다." }
};

function dataStageKey(intent: SearchIntent): string {
  switch (intent) {
    case "policy_lookup":
      return "policy";
    case "general_knowledge_lookup":
      return "knowledge";
    case "document_lookup":
    case "missing_document_lookup":
      return "document";
    case "event_lookup":
      return "event";
    case "training_lookup":
    case "training_gap_lookup":
      return "training";
    case "asset_lookup":
    case "asset_partner_list":
      return "asset";
    case "recent_contracts":
    case "contract_month_lookup":
    case "contract_year_lookup":
    case "date_condition_lookup":
      return "filter";
    default:
      return "partner";
  }
}

function middleStage(intent: SearchIntent): OkeLoadingStage {
  const key = dataStageKey(intent);
  if (
    intent === "recent_contracts" ||
    intent === "contract_month_lookup" ||
    intent === "contract_year_lookup" ||
    intent === "missing_document_lookup" ||
    intent === "asset_partner_list" ||
    intent === "training_gap_lookup" ||
    intent === "date_condition_lookup"
  ) {
    return DATA_STAGE.extract;
  }
  return DATA_STAGE[key] ?? DATA_STAGE.partner;
}

/** 클라이언트 로딩 UI용 단계 목록 */
export function getOkeLoadingStages(query: string): OkeLoadingStage[] {
  const intent = classifyIntent(query.trim());
  const dataStage = middleStage(intent);
  const finalizeStage =
    intent === "recent_contracts" ||
    intent === "contract_month_lookup" ||
    intent === "contract_year_lookup" ||
    intent === "missing_document_lookup" ||
    intent === "asset_partner_list" ||
    intent === "training_gap_lookup" ||
    intent === "date_condition_lookup"
      ? DATA_STAGE.filter
      : dataStage;

  return [
    ...BASE_STAGES,
    finalizeStage,
    { id: "finalize", label: "결과를 정리하고 있습니다." }
  ];
}

export const OKE_STAGE_INTERVAL_MS = 650;
