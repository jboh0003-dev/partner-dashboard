import type { SearchIntent } from "@/lib/search/types";

export type SearchPlan = {
  intent: SearchIntent | "contact_lookup" | "training_lookup" | "pipeline_lookup" | "partner_profile";
  entities: {
    company: string | null;
    person: string | null;
    email: string | null;
    phone: string | null;
    project_code: string | null;
  };
  filters: {
    expected_win?: boolean;
    sales_role?: boolean;
    engineer_role?: boolean;
    training_gap?: boolean;
    surname?: string | null;
    grade?: string | null;
    contract_year?: number | null;
  };
  extra_intents?: string[];
  requested_fields: string[];
};

const ALLOWED_INTENTS = new Set<string>([
  "partner_profile",
  "contact_lookup",
  "training_lookup",
  "asset_lookup",
  "document_lookup",
  "pipeline_lookup",
  "recent_contracts",
  "contract_year_lookup",
  "training_gap_lookup",
  "policy_lookup",
  "tech_partner_training_lookup"
]);

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function planSearchQueryWithLlm(query: string): Promise<SearchPlan | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

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
              "You are a Korean query planner for an internal partner CRM assistant. Interpret informal Korean, short fragments, particles, and synonyms. Do not write SQL. Do not invent facts. Do not explain reasoning. Return JSON only: {\"intent\":\"contact_lookup|training_lookup|pipeline_lookup|partner_profile|asset_lookup|document_lookup|recent_contracts|contract_year_lookup|training_gap_lookup|policy_lookup|tech_partner_training_lookup\",\"entities\":{\"company\":string|null,\"person\":string|null,\"email\":string|null,\"phone\":string|null,\"project_code\":string|null},\"filters\":{\"expected_win\":boolean,\"sales_role\":boolean,\"engineer_role\":boolean,\"training_gap\":boolean,\"grade\":\"platinum|gold|silver|null\",\"contract_year\":number|null},\"extra_intents\":string[],\"requested_fields\":string[]}. Phone synonyms: 번호/폰/전화/연락처. Email: 메일/이메일. Person profile: 누구/뭐하는사람. Affiliation: 어디회사/어느파트너. Expected win: 수주/될만/가능성높은. If person+training, intent=training_lookup with person and company. If platinum+this year contract+no training, intent=training_gap_lookup."
          },
          { role: "user", content: query }
        ]
      })
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const intent = asString(parsed.intent);
    if (!intent || !ALLOWED_INTENTS.has(intent)) return null;
    const entities = (parsed.entities ?? {}) as Record<string, unknown>;
    const filters = (parsed.filters ?? {}) as Record<string, unknown>;
    return {
      intent: intent as SearchPlan["intent"],
      entities: {
        company: asString(entities.company),
        person: asString(entities.person),
        email: asString(entities.email),
        phone: asString(entities.phone),
        project_code: asString(entities.project_code)
      },
      filters: {
        expected_win: Boolean(filters.expected_win),
        sales_role: Boolean(filters.sales_role),
        engineer_role: Boolean(filters.engineer_role),
        training_gap: Boolean(filters.training_gap),
        surname: asString(filters.surname),
        grade: asString(filters.grade),
        contract_year: typeof filters.contract_year === "number" ? filters.contract_year : null
      },
      extra_intents: Array.isArray(parsed.extra_intents)
        ? parsed.extra_intents.filter((item): item is string => typeof item === "string")
        : [],
      requested_fields: Array.isArray(parsed.requested_fields)
        ? parsed.requested_fields.filter((item): item is string => typeof item === "string")
        : []
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
