import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  countMatchPreview,
  getPartnerMatchKey,
  normalizeMatchKey,
  type PartnerMatchStrategy
} from "@/lib/partner-match";

const MatchPayloadSchema = z.object({
  match_strategy: z.enum(["company_name", "business_number"]).default("company_name"),
  rows: z.array(
    z.object({
      company_name: z.string().min(1),
      business_number: z.string().nullable().optional()
    })
  )
});

/**
 * 저장 전 미리보기용 — DB 에 이미 있는 회사명을 조회해 신규/업데이트 건수를 추정한다.
 */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = MatchPayloadSchema.parse(json);
    const supabase = createAdminClient();
    const strategy = parsed.match_strategy as PartnerMatchStrategy;

    const existingKeys = await loadExistingKeys(supabase, strategy, parsed.rows);
    const { newCount, updateCount } = countMatchPreview(parsed.rows, existingKeys, strategy);

    return NextResponse.json({
      ok: true,
      summary: {
        total: parsed.rows.length,
        new: newCount,
        update: updateCount
      },
      existing_keys: Array.from(existingKeys)
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "매칭 조회 실패"
      },
      { status: 400 }
    );
  }
}

async function loadExistingKeys(
  supabase: ReturnType<typeof createAdminClient>,
  strategy: PartnerMatchStrategy,
  rows: Array<{ company_name: string; business_number?: string | null }>
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (rows.length === 0) return keys;

  if (strategy === "company_name") {
    const names = Array.from(
      new Set(rows.map((r) => r.company_name.trim()).filter(Boolean))
    );
    if (names.length === 0) return keys;
    const { data } = await supabase
      .from("partners")
      .select("company_name")
      .in("company_name", names);
    for (const r of data ?? []) {
      if (r.company_name) keys.add(normalizeMatchKey(r.company_name));
    }
    return keys;
  }

  if (strategy === "business_number") {
    const numbers = Array.from(
      new Set(
        rows
          .map((r) => r.business_number?.replace(/[^0-9]/g, "") ?? "")
          .filter(Boolean)
      )
    );
    if (numbers.length === 0) return keys;
    const { data } = await supabase
      .from("partners")
      .select("business_number")
      .in("business_number", numbers);
    for (const r of data ?? []) {
      if (r.business_number) keys.add(String(r.business_number).replace(/[^0-9]/g, ""));
    }
    return keys;
  }

  return keys;
}

export { getPartnerMatchKey };
