"use server";

import { searchPartners } from "@/lib/search/engine";
import type { SearchResult } from "@/lib/search/types";
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
  return query
    .trim()
    .replace(/플레티넘/gi, "플래티넘")
    .replace(/프래티넘/gi, "플래티넘")
    .replace(/파트너쉽/gi, "파트너십")
    .replace(/담당하는\s*사람/gi, "담당자")
    .replace(/사람\s*누구/gi, "담당자 누구")
    .replace(/누가\s*담당/gi, "담당자")
    .replace(/연락\s*어떻게/gi, "연락처")
    .replace(/올라가려면/gi, "승급 조건")
    .replace(/올라가는\s*법/gi, "승급 조건")
    .replace(/어떻게\s*올라가/gi, "승급 조건")
    .replace(/뭐\s*필요(?:해|함|하지)?/gi, "필요 조건")
    .replace(/뭐가\s*필요(?:해|함|하지)?/gi, "필요 조건")
    .replace(/어케/gi, "어떻게")
    .replace(/머야|뭐임|뭔데/gi, "뭐야")
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
      return "파트너 정책 등급 승급 기준 혜택 운영 기준 계약 교육 기술지원 정책 알려줘";
    }
    return `${normalized} 파트너 정책 기준 혜택 운영 가이드`;
  }

  if (/(교육|수강|이수|정기교육|기술파트너\s*교육|시험|인증)/i.test(lower)) {
    return `${normalized} 파트너 교육 수강 이수 참석 기준 현황`;
  }

  if (/(계약|신청|서류|문서|사업자등록|통장|신용평가|가입)/i.test(lower)) {
    return `${normalized} 파트너 계약 신청 필요 서류 문서 등록 절차`;
  }

  if (/(행사|세미나|간담회|파트너데이|킥오프|자료)/i.test(lower)) {
    return `${normalized} 파트너 행사 세미나 자료 일정`;
  }

  if (/(장비|서버|노드|리소스|스펙|하드웨어)/i.test(lower)) {
    return `${normalized} 파트너 장비 리소스 보유 현황`;
  }

  if (/(담당자|연락처|전화|메일|이메일|인력)/i.test(lower)) {
    return `${normalized} 파트너 담당자 연락처 인력`;
  }

  if (/(실적|파이프라인|매출|영업기회|deal|opportunity)/i.test(lower)) {
    return `${normalized} 파트너 실적 파이프라인 영업기회`;
  }

  return normalized;
}

function shouldRetryWithExpandedQuery(result: SearchResult, original: string, expanded: string): boolean {
  if (original === expanded) return false;
  if (result.empty) return true;
  if (result.needsClarification && !/[A-Za-z0-9가-힣]{2,}\s*(주식회사|㈜|\(주\)|회사|시스템|테크|솔루션|정보|네트워크)/i.test(original)) {
    return true;
  }
  return false;
}

function preferResult(first: SearchResult, retry: SearchResult): SearchResult {
  if (!retry.empty && first.empty) return retry;
  if (!retry.needsClarification && first.needsClarification) return retry;
  if ((retry.items?.length ?? 0) > (first.items?.length ?? 0) && !retry.empty) return retry;
  return first;
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
  } else if (expanded !== normalized && /^(정책|파트너\s*정책|제도|파트너\s*제도)/i.test(normalized)) {
    // "정책 알려줘"처럼 너무 짧은 질문은 처음부터 넓은 정책 검색 결과를 우선한다.
    const retry = await searchPartners(expanded);
    result = preferResult(result, retry);
  }

  return {
    ...result,
    answer: formatAnswerForReading(result.answer)
  };
}
