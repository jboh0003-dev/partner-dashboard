import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMPTY_APPLICATION_FORM } from "@/lib/partner-applications/types";
import {
  generateAccessToken,
  generateApplicationNumber,
  generateLookupPassword,
  hashSecret
} from "@/lib/partner-applications/tokens";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/partner-applications/rate-limit";
import { logApplicationEvent } from "@/lib/partner-applications/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = checkRateLimit(`pa-create:${ip}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  let body: { honeypot?: string; applicant_email?: string; applicant_name?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Bot honeypot — must stay empty
  if (body.honeypot) {
    return NextResponse.json({ ok: true, application_id: "ok" });
  }

  const accessToken = generateAccessToken();
  const lookupPassword = generateLookupPassword();
  const applicationNumber = generateApplicationNumber();
  const form = {
    ...EMPTY_APPLICATION_FORM,
    applicant: {
      name: String(body.applicant_name ?? "").trim(),
      email: String(body.applicant_email ?? "").trim().toLowerCase()
    }
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_applications")
    .insert({
      application_number: applicationNumber,
      status: "draft",
      access_token_hash: hashSecret(accessToken),
      lookup_password_hash: hashSecret(lookupPassword),
      form_payload: form,
      applicant_name: form.applicant.name || null,
      applicant_email: form.applicant.email || null,
      missing_required_count: 0
    })
    .select("id, application_number, status")
    .single();

  if (error || !data) {
    return NextResponse.json({ ok: false, message: "신청서 생성에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
  }

  await logApplicationEvent(supabase, data.id, "created", "신청 초안 생성");

  return NextResponse.json({
    ok: true,
    application_id: data.id,
    application_number: data.application_number,
    status: data.status,
    access_token: accessToken,
    lookup_password: lookupPassword,
    resume_path: `/partner-apply/${data.id}?token=${encodeURIComponent(accessToken)}`
  });
}
