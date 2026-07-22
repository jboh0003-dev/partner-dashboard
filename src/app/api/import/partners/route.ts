import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPartnerMatchKey, normalizeMatchKey } from "@/lib/partner-match";

const MonthlyCellSchema = z.object({
  training_year: z.number().int(),
  training_month: z.number().int().min(1).max(12),
  training_label: z.string().nullable().optional(),
  attended: z.boolean(),
  raw_value: z.string().nullable().optional()
});

const ImportRowSchema = z.object({
  company_name: z.string().min(1),
  grade: z.string().nullable().optional(),
  grade_raw: z.string().nullable().optional(),
  contract_start_date: z.string().nullable().optional(),
  primary_email: z.string().nullable().optional(),
  email_memo: z.string().nullable().optional(),
  has_training: z.boolean().optional(),
  theory_only: z.boolean().optional(),
  has_sales_opportunity: z.boolean().optional(),
  data_quality_warning: z.string().nullable().optional(),
  monthly: z.array(MonthlyCellSchema).default([])
});

const ImportPayloadSchema = z.object({
  match_strategy: z.enum(["company_name", "business_number"]).default("company_name"),
  rows: z.array(ImportRowSchema)
});

type ImportRow = z.infer<typeof ImportRowSchema>;

type RowResult = {
  company_name: string;
  status: "created" | "updated" | "error";
  partner_id: string | null;
  message: string | null;
};

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return unauthorizedJson(auth.message);

    const json = await request.json();
    const parsed = ImportPayloadSchema.parse(json);
    const supabase = createAdminClient();

    const matchStrategy = parsed.match_strategy;
    const rowResults: RowResult[] = [];
    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    const existingMap = await loadExistingPartnersMap(
      supabase,
      matchStrategy,
      parsed.rows
    );

    for (const row of parsed.rows) {
      const matchKey = getPartnerMatchKey(row, matchStrategy);
      const existingId = matchKey ? existingMap.get(matchKey) ?? null : null;

      const payload: Record<string, unknown> = {
        company_name: row.company_name,
        grade: row.grade ?? "none",
        grade_raw: row.grade_raw ?? null,
        contract_start_date: row.contract_start_date ?? null,
        primary_email: row.primary_email ?? null,
        has_training: row.has_training ?? false,
        theory_only: row.theory_only ?? false,
        has_sales_opportunity: row.has_sales_opportunity ?? false,
        data_quality_warning: row.data_quality_warning ?? null,
        status: "active" as const
      };

      // email_memo 는 있을 때만 memo 에 반영 (업데이트 시 기존 메모를 null 로 덮어쓰지 않음)
      if (row.email_memo) {
        payload.memo = row.email_memo;
      }

      try {
        let partnerId: string;
        let isCreate = false;

        if (existingId) {
          const { error: updateError } = await supabase
            .from("partners")
            .update(payload)
            .eq("id", existingId);
          if (updateError) throw new Error(updateError.message);
          partnerId = existingId;
        } else {
          const { data: inserted, error: insertError } = await supabase
            .from("partners")
            .insert(payload)
            .select("id")
            .single();
          if (insertError || !inserted) {
            throw new Error(insertError?.message ?? "insert failed");
          }
          partnerId = inserted.id;
          isCreate = true;
          if (matchKey) existingMap.set(matchKey, partnerId);
        }

        await replaceMonthlyTrainings(supabase, partnerId, row.monthly);

        rowResults.push({
          company_name: row.company_name,
          status: isCreate ? "created" : "updated",
          partner_id: partnerId,
          message: null
        });
        if (isCreate) createdCount += 1;
        else updatedCount += 1;
      } catch (err) {
        errorCount += 1;
        rowResults.push({
          company_name: row.company_name,
          status: "error",
          partner_id: null,
          message: err instanceof Error ? err.message : "알 수 없는 오류"
        });
      }
    }

    revalidatePath("/dashboard/partners", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/upload");

    return NextResponse.json({
      ok: true,
      summary: {
        total: parsed.rows.length,
        created: createdCount,
        updated: updatedCount,
        errors: errorCount
      },
      results: rowResults
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "알 수 없는 오류"
      },
      { status: 400 }
    );
  }
}

async function loadExistingPartnersMap(
  supabase: ReturnType<typeof createAdminClient>,
  strategy: "company_name" | "business_number",
  rows: ImportRow[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (rows.length === 0) return map;

  if (strategy === "company_name") {
    const names = Array.from(
      new Set(rows.map((r) => r.company_name.trim()).filter(Boolean))
    );
    if (names.length === 0) return map;
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .in("company_name", names);
    for (const r of data ?? []) {
      if (r.company_name) map.set(normalizeMatchKey(r.company_name), r.id as string);
    }
    return map;
  }

  if (strategy === "business_number") {
    const numbers = Array.from(
      new Set(
        rows
          .map((r) => (r as ImportRow & { business_number?: string }).business_number)
          .filter(Boolean)
      )
    );
    if (numbers.length === 0) return map;
    const { data } = await supabase
      .from("partners")
      .select("id, business_number")
      .in("business_number", numbers);
    for (const r of data ?? []) {
      if (r.business_number) {
        map.set(String(r.business_number).replace(/[^0-9]/g, ""), r.id as string);
      }
    }
  }

  return map;
}

async function replaceMonthlyTrainings(
  supabase: ReturnType<typeof createAdminClient>,
  partnerId: string,
  monthly: ImportRow["monthly"]
) {
  const { error: deleteError } = await supabase
    .from("partner_training_monthly")
    .delete()
    .eq("partner_id", partnerId);
  if (deleteError) throw new Error(deleteError.message);

  if (monthly.length === 0) return;

  const insertRows = monthly.map((m) => ({
    partner_id: partnerId,
    training_year: m.training_year,
    training_month: m.training_month,
    training_label: m.training_label ?? null,
    attended: m.attended,
    raw_value: m.raw_value ?? null
  }));

  const { error: insertError } = await supabase
    .from("partner_training_monthly")
    .insert(insertRows);
  if (insertError) throw new Error(insertError.message);
}
