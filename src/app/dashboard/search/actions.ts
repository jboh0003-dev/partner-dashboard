"use server";

import { searchPartners } from "@/lib/search/engine";
import type { SearchResult } from "@/lib/search/types";

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

  // 긴 한 문단 답변은 문장 단위로 끊어 읽기 쉽게 표시한다.
  return normalized
    .replace(/([.!?])\s+(?=[가-힣A-Za-z0-9])/g, "$1\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function runPartnerSearch(query: string): Promise<SearchResult> {
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

  const result = await searchPartners(trimmed);
  return {
    ...result,
    answer: formatAnswerForReading(result.answer)
  };
}
