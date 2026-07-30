import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { approvePartnerApplication } from "@/lib/partner-applications/approve";
import { parsePartnerContractGrade } from "@/lib/partner-application/contract-dates";
import { logApplicationEvent } from "@/lib/partner-applications/repository";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const ApproveSchema = z.object({
  grade: z.string(),
  contract_start_date: z.string().min(8),
  confirm_duplicate: z.boolean().optional(),
  existing_partner_id: z.string().uuid().nullable().optional()
});

const ReviseSchema = z.object({
  reason: z.string().min(1),
  missing_labels: z.array(z.string()).optional()
});

const RejectSchema = z.object({
  reason: z.string().min(1)
});

const MemoSchema = z.object({
  memo: z.string()
});

export async function POST(request: Request, context: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return unauthorizedJson(auth.message);
  const { id } = await context.params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "approve";
  const supabase = createAdminClient();
  const body = await request.json().catch(() => ({}));

  if (action === "approve") {
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "승인 파라미터가 올바르지 않습니다." }, { status: 400 });
    }
    const grade = parsePartnerContractGrade(parsed.data.grade);
    if (!grade) {
      return NextResponse.json({ ok: false, message: "등급이 올바르지 않습니다." }, { status: 400 });
    }
    const result = await approvePartnerApplication(supabase, id, {
      grade,
      contractStartDate: parsed.data.contract_start_date,
      confirmDuplicate: parsed.data.confirm_duplicate,
      existingPartnerId: parsed.data.existing_partner_id ?? null,
      reviewedBy: auth.userId
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: result.duplicate ? 409 : 400 });
    }
    return NextResponse.json(result);
  }

  if (action === "revise") {
    const parsed = ReviseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "보완 사유가 필요합니다." }, { status: 400 });
    }
    const reason = [
      parsed.data.reason,
      ...(parsed.data.missing_labels?.length
        ? [`누락: ${parsed.data.missing_labels.join(", ")}`]
        : [])
    ].join("\n");
    const { error } = await supabase
      .from("partner_applications")
      .update({
        status: "revision_requested",
        revision_reason: reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.userId,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    await logApplicationEvent(supabase, id, "revision_requested", reason, {}, auth.userId);
    return NextResponse.json({ ok: true });
  }

  if (action === "reject") {
    const parsed = RejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "반려 사유가 필요합니다." }, { status: 400 });
    }
    const { error } = await supabase
      .from("partner_applications")
      .update({
        status: "rejected",
        revision_reason: parsed.data.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.userId,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    await logApplicationEvent(
      supabase,
      id,
      "rejected",
      parsed.data.reason,
      {},
      auth.userId
    );
    return NextResponse.json({ ok: true });
  }

  if (action === "under_review") {
    const { error } = await supabase
      .from("partner_applications")
      .update({
        status: "under_review",
        reviewed_by: auth.userId,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    await logApplicationEvent(supabase, id, "under_review", "검토 시작", {}, auth.userId);
    return NextResponse.json({ ok: true });
  }

  if (action === "memo") {
    const parsed = MemoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "메모가 필요합니다." }, { status: 400 });
    }
    const { error } = await supabase
      .from("partner_applications")
      .update({ admin_memo: parsed.data.memo, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, message: "알 수 없는 action" }, { status: 400 });
}
