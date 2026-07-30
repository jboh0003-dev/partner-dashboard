import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerApplicationFormPayload } from "@/lib/partner-applications/types";
import { verifySecret } from "@/lib/partner-applications/tokens";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/partner-applications/rate-limit";
import {
  countActiveBusinessRegistrationDoc,
  logApplicationEvent,
  saveApplicationForm
} from "@/lib/partner-applications/repository";
import { collectMissingFields } from "@/lib/partner-applications/validation";

export const runtime = "nodejs";

const BodySchema = z.object({
  token: z.string().min(10),
  form: z.record(z.string(), z.unknown()).optional(),
  honeypot: z.string().optional()
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const { id } = await context.params;
  const ip = clientIpFromHeaders(request.headers);
  const limited = checkRateLimit(`pa-submit:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다." }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (parsed.data.honeypot) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !app) {
    return NextResponse.json({ ok: false, message: "신청서를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!verifySecret(parsed.data.token, String(app.access_token_hash))) {
    return NextResponse.json({ ok: false, message: "수정 권한이 없습니다." }, { status: 403 });
  }
  if (!["draft", "revision_requested"].includes(String(app.status))) {
    return NextResponse.json(
      { ok: false, message: "이미 제출되었거나 수정할 수 없는 상태입니다." },
      { status: 409 }
    );
  }

  const form = (parsed.data.form ?? app.form_payload) as PartnerApplicationFormPayload;
  try {
    await saveApplicationForm(supabase, id, form);
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "저장 실패" },
      { status: 500 }
    );
  }

  const hasDoc = await countActiveBusinessRegistrationDoc(supabase, id);
  const missing = collectMissingFields(form, { hasBusinessRegistrationDoc: hasDoc });
  if (missing.length) {
    return NextResponse.json(
      {
        ok: false,
        message: `필수 항목 ${missing.length}개가 누락되었습니다.`,
        missing
      },
      { status: 400 }
    );
  }

  const { error: updErr } = await supabase
    .from("partner_applications")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      missing_required_count: 0,
      updated_at: new Date().toISOString()
    })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ ok: false, message: updErr.message }, { status: 500 });
  }

  await logApplicationEvent(supabase, id, "submitted", "최종 제출");

  return NextResponse.json({
    ok: true,
    application_number: app.application_number,
    status: "submitted",
    message: "신청이 제출되었습니다."
  });
}
