"use server";

import { searchPartners } from "@/lib/search/engine";
import type { SearchResult } from "@/lib/search/types";
import { normalizeSearchQuery } from "@/lib/search/query-normalize";
import { requireUser } from "@/lib/auth/require-user";

function formatAnswerForReading(answer: string): string {
  const normalized = answer
    .replace(/\s*•\s*/g, "\n• ")
    .replace(/\s+·\s+/g, "\n• ")
    .replace(/\s+(?=(?:Platinum|Gold|Silver|Service Partner)\b)/g, "\n• ")
    .replace(/\s+(?=(?:기술역량|영업역량|기술지원|승급|유지|예외|참고|주의)\s*[:：])/g, "\n• ")
    .replace(/\s*\(근거:\s*/g, "\n\n근거: ")
    .replace(/\)\s*$/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.includes("\n") || normalized.length < 220) {
    return normalized;
  }

  return normalized
    .replace(/([.!?])\s+(?=[가-힣A-Za-z0-9])/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeConversationalQuery(query: string): string {
  return (normalizeSearchQuery(query) || query.trim())
    .replace(/담당자\s*누구(?:야|임|냐|지)?/gi, "담당자")
    .replace(/사람\s*누구(?:야|임|냐|지)?/gi, "담당자")
    .replace(/누가\s*담당(?:해|함|이야|인가|인지)?/gi, "담당자")
    .replace(/영업\s*하는\s*사람/gi, "영업 담당자")
    .replace(/기술\s*하는\s*사람/gi, "기술 담당자")
    .replace(/계약\s*하는\s*사람/gi, "계약 담당자")
    .replace(/연락\s*어떻게/gi, "연락처")
    .replace(/번호\s*(?:좀|줘|알려)?/gi, "연락처")
    .replace(/메일\s*(?:좀|줘|알려)?/gi, "이메일")
    .replace(/올라가려면/gi, "승급 조건")
    .replace(/올라가는\s*법/gi, "승급 조건")
    .replace(/어떻게\s*올라가/gi, "승급 조건")
    .replace(/어디\s*회사(?:야|임|인지)?/gi, "소속 회사")
    .replace(/뭐\s*하는\s*사람(?:이야|임|인지)?/gi, "담당 역할")
    .replace(/\s+/g, " ")
    .trim();
}

function expandNaturalLanguageQuery(query: string): string {
  const normalized = normalizeConversationalQuery(query);
  const lower = normalized.toLowerCase();

  const hasPolicyTopic = /(정책|제도|규정|룰|운영\s*방식|운영\s*기준|등급|승급|플래티넘|골드|실버|service\s*partner|혜택|지원\s*기준|파트너\s*프로그램|파트너십)/i.test(lower);
  if (hasPolicyTopic) {
    const genericPolicyOnly = /^(정책|파트너\s*정책|제도|파트너\s*제도)(\s*(알려줘|알려\s*줘|설명해줘|설명|뭐야|궁금해|어떻게돼|어떻게\s*돼|전체|좀))*[?!.]*$/i.test(normalized);
    if (genericPolicyOnly) {
      return "파트너 정책 등급 승급 기준 혜택 운영 기준 계약 교육 기술지원 정책";
    }
    return `${normalized} 파트너 정책 기준 혜택 운영 가이드`;
  }

  if (/(교육|수강|이수|정기교육|기술파트너\s*교육|시험|인증|교육이력|교육내역|미수강)/i.test(lower)) {
    return `${normalized} 파트너 교육 수강 이수 참석 기준 현황`;
  }

  if (/(계약|신청|서류|문서|사업자등록|통장|신용평가|가입|회사소개서)/i.test(lower)) {
    return `${normalized} 파트너 계약 신청 필요 서류 문서 등록 절차`;
  }

  if (/(행사|세미나|간담회|파트너데이|킥오프|자료)/i.test(lower)) {
    return `${normalized} 파트너 행사 세미나 자료 일정`;
  }

  if (/(장비|서버|노드|리소스|스펙|사양|하드웨어)/i.test(lower)) {
    return `${normalized} 파트너 장비 리소스 보유 현황`;
  }

  if (/(담당자|연락처|전화|번호|메일|이메일|인력|소속|영업\s*담당|기술\s*담당)/i.test(lower)) {
    return `${normalized} 파트너 담당자 연락처 인력 소속`;
  }

  if (/(실적|파이프라인|매출|영업기회|수주|될만|가능성|deal|opportunity|프로젝트)/i.test(lower)) {
    return `${normalized} 파트너 실적 파이프라인 영업기회 수주 예상`;
  }

  return normalized;
}

function shouldRetryWithExpandedQuery(
  result: SearchResult,
  original: string,
  expanded: string
): boolean {
  if (original === expanded) return false;
  if (result.empty) return true;
  if (result.needsClarification) return true;

  // 자연어 질문이 기본 정보로 잘못 떨어진 경우에는 의도 키워드를 보강해 한 번 더 검색한다.
  if (
    result.intent === "partner_profile" &&
    /(담당|연락|메일|교육|장비|리소스|문서|계약서|신청서|실적|파이프라인|수주|정책|행사)/i.test(
      expanded
    )
  ) {
    return true;
  }

  return false;
}

function resultQualityScore(result: SearchResult): number {
  let score = 0;
  if (!result.empty) score += 100;
  if (!result.needsClarification) score += 30;
  if (result.matchedPartner) score += 20;
  score += Math.min(result.items?.length ?? 0, 20);
  score += Math.min(result.contacts?.length ?? 0, 10);
  if (result.intent !== "partner_profile") score += 5;
  return score;
}

function preferResult(first: SearchResult, retry: SearchResult): SearchResult {
  return resultQualityScore(retry) > resultQualityScore(first) ? retry : first;
}

export async function runPartnerSearch(query: string): Promise<SearchResult> {
  const auth = await requireUser();
  if (!auth.ok) {
    return {
      answer: "로그인이 필요합니다.",
      intent: "partner_profile",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources: [],
      matchStrategy: "none"
    };
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return {
      answer: "질문을 입력해 주세요.",
      intent: "partner_profile",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources: [],
      matchStrategy: "none"
    };
  }

  const normalized = normalizeConversationalQuery(trimmed);
  const expanded = expandNaturalLanguageQuery(trimmed);

  let result = await searchPartners(normalized);

  if (shouldRetryWithExpandedQuery(result, normalized, expanded)) {
    const retry = await searchPartners(expanded);
    result = preferResult(result, retry);
  } else if (
    expanded !== normalized &&
    /^(정책|파트너\s*정책|제도|파트너\s*제도)/i.test(normalized)
  ) {
    // "정책 알려줘"처럼 너무 짧은 질문은 넓은 정책 검색 결과도 비교한다.
    const retry = await searchPartners(expanded);
    result = preferResult(result, retry);
  }

  return {
    ...result,
    answer: formatAnswerForReading(result.answer)
  };
}
