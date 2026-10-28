import type { SearchResult } from "@/lib/search/types";

export type AgentConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type CompletionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type PartnerAgentProvider = {
  endpoint: string;
  token: string;
  model: string;
};

function getPartnerAgentProvider(): PartnerAgentProvider | null {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) return { endpoint: "https://api.groq.com/openai/v1/chat/completions", token: groqKey, model: "openai/gpt-oss-120b" };
  const gatewayToken =
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim();

  if (gatewayToken) {
    return {
      endpoint: "https://ai-gateway.vercel.sh/v1/chat/completions",
      token: gatewayToken,
      model:
        process.env.PARTNER_AGENT_MODEL?.trim() ||
        process.env.OPENAI_MODEL?.trim() ||
        "openai/gpt-5.6-sol"
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      endpoint: "https://api.openai.com/v1/chat/completions",
      token: openAiKey,
      model:
        process.env.PARTNER_AGENT_MODEL?.trim() ||
        process.env.OPENAI_MODEL?.trim() ||
        "gpt-5.6-sol"
    };
  }

  return null;
}

export function isPartnerAgentLlmAvailable(): boolean {
  return Boolean(getPartnerAgentProvider());
}

async function requestCompletion(
  messages: CompletionMessage[],
  options?: {
    timeoutMs?: number;
    jsonMode?: boolean;
  }
): Promise<string | null> {
  const provider = getPartnerAgentProvider();
  if (!provider) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 12000
  );

  try {
    const response = await fetch(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.token}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
        messages,
        ...(options?.jsonMode
          ? { response_format: { type: "json_object" } }
          : {})
      })
    });

    if (!response.ok) return null;

    const json = (await response.json()) as ChatCompletionResponse;
    const content = json.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestPartnerAgentJson(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 8000
): Promise<Record<string, unknown> | null> {
  const content = await requestCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    { timeoutMs, jsonMode: true }
  );

  if (!content) return null;

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    const match = content.match(/{[sS]*}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function cleanHistory(
  history: AgentConversationMessage[] | undefined
): AgentConversationMessage[] {
  if (!history?.length) return [];

  return history
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim()
    )
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 1200)
    }));
}

function likelyNeedsConversationContext(query: string): boolean {
  const text = query.trim();
  if (!text) return false;

  if (
    /^(그럼|그러면|그거|그건|그쪽|거기|그 회사|그 사람|얘|걔|그래서|근데|그리고|또|그중|이중)/.test(
      text
    )
  ) {
    return true;
  }

  if (
    /^(담당자는|담당자|연락처는|전화는|메일은|이메일은|교육은|장비는|문서는|계약은|실적은|파이프라인은|매출은|직원은|인력은|누구야|누구지|몇명이야|몇 명이야)/.test(
      text
    )
  ) {
    return true;
  }

  return text.length <= 12 && /[은는이가을를요?]$/.test(text);
}

export async function rewriteConversationalSearchQuery(
  query: string,
  history?: AgentConversationMessage[]
): Promise<string> {
  const clean = cleanHistory(history);
  if (clean.length === 0 || !likelyNeedsConversationContext(query)) {
    return query.trim();
  }

  const content = await requestCompletion(
    [
      {
        role: "system",
        content:
          "You rewrite a Korean follow-up question into one standalone retrieval query for an internal Partner Connect CRM. Use conversation history only to resolve references such as 그 회사, 그 사람, 담당자는, 교육은. Preserve exact company names, person names, emails, phone numbers, dates, grades, product names, and project codes. Do not answer the question. Do not add facts. Return only the rewritten query in Korean, one line, under 160 characters."
      },
      ...clean,
      { role: "user", content: query.trim() }
    ],
    { timeoutMs: 7000 }
  );

  return content?.replace(/^["']|["']$/g, "").trim() || query.trim();
}

function compactSearchResult(result: SearchResult): Record<string, unknown> {
  return {
    legacy_answer: result.answer,
    criteria: result.criteria ?? null,
    intent: result.intent,
    empty: result.empty,
    needs_clarification: Boolean(result.needsClarification),
    matched_partner: result.matchedPartner
      ? {
          name: result.matchedPartner.name,
          href: result.matchedPartner.href
        }
      : null,
    partners: result.partners.slice(0, 30).map((partner) => ({
      name: partner.name,
      href: partner.href
    })),
    contacts: result.contacts.slice(0, 30).map((contact) => ({
      name: contact.name,
      partner: contact.partnerName,
      role: contact.role,
      position: contact.position ?? null,
      phone: contact.phone,
      email: contact.email
    })),
    items: result.items.slice(0, 40).map((item) => ({
      title: item.title,
      subtitle: item.subtitle ?? null,
      meta: item.meta ?? null,
      href: item.href ?? null,
      kind: item.kind ?? null
    })),
    summary_cards: result.summaryCards?.slice(0, 12) ?? [],
    list_result: result.listResult
      ? {
          title: result.listResult.title,
          criteria: result.listResult.criteria,
          total_count: result.listResult.totalCount,
          columns: result.listResult.columns,
          rows: result.listResult.rows.slice(0, 60)
        }
      : null,
    sources: result.sources.map((source) => ({
      type: source.type,
      label: source.label,
      updated_at: source.updatedAt ?? null
    })),
    follow_up_queries: result.followUpQueries?.slice(0, 8) ?? []
  };
}

export async function synthesizeConversationalAnswer(input: {
  question: string;
  standaloneQuery: string;
  history?: AgentConversationMessage[];
  result: SearchResult;
}): Promise<string | null> {
  if (!isPartnerAgentLlmAvailable()) return null;

  const history = cleanHistory(input.history);
  const evidence = JSON.stringify(compactSearchResult(input.result));

  const content = await requestCompletion(
    [
      {
        role: "system",
        content:
          "당신은 오케스트로 Partner Connect의 내부 AI Agent입니다. 사용자의 질문에 한국어로 자연스럽고 충분하게 답하세요. 아래 원칙은 반드시 지킵니다.\n" +
          "1) 제공된 RETRIEVED_DATA에 있는 사실만 사용합니다. 추측하거나 없는 정보를 만들지 않습니다.\n" +
          "2) RETRIEVED_DATA 안에 사용자가 묻는 정보가 있으면 반드시 직접 답합니다. '확인되지 않는다'는 표현으로 회피하지 않습니다.\n" +
          "3) legacy_answer는 기존 규칙형 답변일 뿐이므로, contacts/items/list_result/summary_cards 같은 구조화 데이터가 더 구체적이면 그것을 우선합니다.\n" +
          "4) 대화의 이전 맥락을 이해해 후속 질문에도 자연스럽게 이어서 답합니다.\n" +
          "5) 데이터가 실제로 없으면 '현재 Partner Connect에 등록된 정보에서는 확인되지 않습니다'라고 말하고, 후보가 있으면 무엇을 확인하면 되는지 짧게 안내합니다.\n" +
          "6) 내부 구현, RAG, JSON, 검색 intent 같은 기술 용어는 사용자에게 말하지 않습니다.\n" +
          "7) 한 줄짜리 기계적 답변보다 사람이 대화하듯 핵심부터 답하고 필요한 세부사항을 붙입니다. 목록이 필요하면 짧은 불릿을 사용합니다.\n" +
          "8) 개인정보는 사용자가 업무상 조회를 요청한 범위에서만 노출합니다."
      },
      ...history,
      {
        role: "user",
        content:
          `현재 질문: ${input.question}\n독립형 검색질의: ${input.standaloneQuery}\n\nRETRIEVED_DATA:\n${evidence}`
      }
    ],
    { timeoutMs: 14000 }
  );

  return content?.trim() || null;
}
