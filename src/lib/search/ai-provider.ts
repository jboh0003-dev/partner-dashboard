// Server-side provider configuration. Never import this module into a client component.
export type AgentProvider = { endpoint: string; token: string; model: string };

export function getChatProvider(): AgentProvider | null {
  const exaoneKey = process.env.EXAONE_API_KEY?.trim();
  if (exaoneKey) return {
    endpoint: "https://api.exaone.ai/v1/chat/completions",
    token: exaoneKey,
    model: "k-exaone_v2.5"
  };
  const groqKey = process.env.GROQ_API_KEY?.trim();
  return groqKey ? {
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    token: groqKey,
    model: "openai/gpt-oss-120b"
  } : null;
}

export function completionOptions(provider: AgentProvider, jsonMode = false, outputTokens = 900) {
  // EXAONE counts thinking tokens in max_tokens and does not document response_format.
  // Ask for JSON in the prompt, then validate it at the caller instead.
  if (provider.endpoint === "https://api.exaone.ai/v1/chat/completions") {
    return { max_tokens: Math.max(4096, outputTokens), reasoning_effort: "low", temperature: 1, top_p: 0.95 };
  }
  return {
    max_completion_tokens: outputTokens,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {})
  };
}

export function parseAgentJson(content: string): Record<string, unknown> | null {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value: unknown = JSON.parse(cleaned);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
