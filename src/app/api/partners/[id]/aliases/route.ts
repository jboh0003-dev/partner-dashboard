import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPerformanceNameKeys,
  normalizePerformancePartnerName
} from "@/lib/partners/performance-match";

const BodySchema = z.object({
  alias_name: z.string().min(1),
  source: z.string().optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partnerId } = await context.params;
    const body = BodySchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("id", partnerId)
      .maybeSingle();

    if (!partner) {
      return NextResponse.json({ ok: false, message: "파트너를 찾을 수 없습니다." }, { status: 404 });
    }

    const aliasName = body.alias_name.trim();
    const keys = getPerformanceNameKeys(aliasName);
    const normalized = normalizePerformancePartnerName(aliasName);
    const insertKeys = normalized ? Array.from(new Set([...keys, normalized])) : keys;

    for (const key of insertKeys) {
      const { error } = await supabase.from("partner_aliases").upsert(
        {
          partner_id: partnerId,
          alias_name: aliasName,
          normalized_alias: key,
          source: body.source ?? "manual",
          updated_at: new Date().toISOString()
        },
        { onConflict: "normalized_alias" }
      );
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, alias_count: insertKeys.length });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "별칭 저장 실패"
      },
      { status: 400 }
    );
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: partnerId } = await context.params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("partner_aliases")
    .select("id, alias_name, normalized_alias, source, created_at")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ ok: true, aliases: data ?? [] });
}
