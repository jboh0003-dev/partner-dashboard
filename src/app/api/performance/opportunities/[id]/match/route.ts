import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPerformanceNameKeys,
  normalizePerformancePartnerName
} from "@/lib/partners/performance-match";

const BodySchema = z.object({
  action: z.enum(["match", "not_partner"]),
  partner_id: z.string().uuid().optional(),
  save_alias: z.boolean().optional(),
  raw_partner_name: z.string().optional(),
  note: z.string().optional()
});

async function savePartnerAliases(
  supabase: ReturnType<typeof createAdminClient>,
  partnerId: string,
  rawName: string,
  source: string
) {
  const keys = getPerformanceNameKeys(rawName);
  const normalized = normalizePerformancePartnerName(rawName);
  const insertKeys = normalized ? Array.from(new Set([...keys, normalized])) : keys;

  for (const key of insertKeys) {
    const { error } = await supabase.from("partner_aliases").upsert(
      {
        partner_id: partnerId,
        alias_name: rawName,
        normalized_alias: key,
        source,
        updated_at: new Date().toISOString()
      },
      { onConflict: "normalized_alias" }
    );
    if (error) throw new Error(error.message);
  }

  return insertKeys.length;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = BodySchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: opportunity, error: fetchError } = await supabase
      .from("partner_pipeline_opportunities")
      .select("id, raw_partner_name, partner_name, snapshot_id")
      .eq("id", id)
      .single();

    if (fetchError || !opportunity) {
      return NextResponse.json({ ok: false, message: "영업기회를 찾을 수 없습니다." }, { status: 404 });
    }

    const rawName =
      body.raw_partner_name?.trim() ||
      opportunity.raw_partner_name ||
      opportunity.partner_name ||
      "";

    let updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    let reviewAction = body.action;
    let aliasName: string | null = null;
    let partnerId: string | null = null;
    let aliasSaved = false;

    if (body.action === "match") {
      if (!body.partner_id) {
        return NextResponse.json({ ok: false, message: "파트너를 선택해 주세요." }, { status: 400 });
      }

      const { data: partner } = await supabase
        .from("partners")
        .select("id, company_name")
        .eq("id", body.partner_id)
        .is("deleted_at", null)
        .single();

      if (!partner) {
        return NextResponse.json({ ok: false, message: "파트너를 찾을 수 없습니다." }, { status: 404 });
      }

      partnerId = String(partner.id);
      aliasSaved = Boolean(body.save_alias && rawName);

      if (aliasSaved) {
        aliasName = rawName;
        await savePartnerAliases(supabase, partnerId, rawName, "performance_manual");
      }

      updatePayload = {
        ...updatePayload,
        matched_partner_id: partnerId,
        matched_partner_name: partner.company_name,
        match_status: aliasSaved ? "alias_matched" : "matched",
        match_reason: null,
        review_memo: body.note ?? (aliasSaved ? "수동 매칭 + 별칭 저장" : "수동 매칭")
      };
    } else if (body.action === "not_partner") {
      updatePayload = {
        ...updatePayload,
        matched_partner_id: null,
        matched_partner_name: null,
        match_status: "not_partner",
        match_reason: "파트너 아님으로 지정",
        review_memo: body.note ?? null
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from("partner_pipeline_opportunities")
      .update(updatePayload)
      .eq("id", id)
      .select(
        "id, matched_partner_id, matched_partner_name, match_status, match_reason, review_memo, raw_partner_name, partner_name"
      )
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "업데이트 실패");
    }

    await supabase.from("performance_match_reviews").insert({
      opportunity_id: id,
      action: reviewAction,
      raw_partner_name: rawName || null,
      partner_id: partnerId,
      alias_name: aliasName,
      reviewer_note: body.note ?? null
    });

    revalidatePath("/dashboard/performance");

    return NextResponse.json({
      ok: true,
      alias_saved: aliasSaved,
      opportunity: updated
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "매칭 처리 실패"
      },
      { status: 400 }
    );
  }
}
