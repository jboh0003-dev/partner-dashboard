export type PreReviewAiFinding = {
  id: string;
  label: string;
  severity: "admin_check";
  source: "ai";
  detail?: string;
};

type TextReviewInput = {
  company_name?: string;
  sales_strategy?: string;
  customers?: Array<{
    customer_name?: string | null;
    proposal_status?: string | null;
    note?: string | null;
  }>;
};

function compactText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export async function reviewApplicationTextWithOptionalLlm(input: TextReviewInput): Promise<{
  used: boolean;
  error: string | null;
  findings: PreReviewAiFinding[];
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { used: false, error: null, findings: [] };
  }

  const strategy = compactText(input.sales_strategy);
  const customerNotes = (input.customers ?? [])
    .map((c) => compactText(c.note))
    .filter(Boolean);
  if (!strategy && customerNotes.length === 0) {
    return { used: false, error: null, findings: [] };
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You review Korean partner applications. Return JSON {\"findings\":[{\"label\":\"...\",\"detail\":\"...\"}]}. Only flag items a human admin should verify in sales-plan or customer text. Never mention platinum grade, technical collaboration flags, contract dates, or partner grade. Never invent missing documents or required fields. Never approve. If nothing needs human judgment, return {\"findings\":[]}."
          },
          {
            role: "user",
            content: JSON.stringify({
              company_name: input.company_name,
              sales_strategy: strategy || null,
              customer_notes: customerNotes
            })
          }
        ]
      })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        used: true,
        error: `LLM HTTP ${res.status}${body ? `: ${body.slice(0, 180)}` : ""}`,
        findings: []
      };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content || "{}";
    let parsed: { findings?: Array<{ label?: string; detail?: string }> };
    try {
      parsed = JSON.parse(content) as { findings?: Array<{ label?: string; detail?: string }> };
    } catch {
      return { used: true, error: "LLM 응답을 해석하지 못했습니다.", findings: [] };
    }

    const findings: PreReviewAiFinding[] = (parsed.findings ?? [])
      .map((item, index) => ({
        id: `ai.text.${index}`,
        label: compactText(item.label),
        severity: "admin_check" as const,
        source: "ai" as const,
        detail: compactText(item.detail) || undefined
      }))
      .filter((item) => item.label);

    return { used: true, error: null, findings };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "LLM 응답 시간이 초과되었습니다."
        : error instanceof Error
          ? error.message
          : "LLM 호출 실패";
    return { used: true, error: message, findings: [] };
  } finally {
    clearTimeout(timeout);
  }
}
