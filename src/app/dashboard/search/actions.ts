"use server";

import { searchPartners } from "@/lib/search/engine";
import type { SearchResult } from "@/lib/search/types";

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

  return searchPartners(trimmed);
}
