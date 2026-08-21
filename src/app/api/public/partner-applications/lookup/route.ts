import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySecret } from "@/lib/partner-applications/tokens";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/partner-applications/rate-limit";

export const runtime = "nodejs";

const BodySchema = z.object({
  application_number: z.string().min(3).optional(),
  email: z.string().email().optional(),
  lookup_password: z.string().min(4)
});

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = checkRateLimit(`pa-lookup:${ip}`, 15, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다." }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!parsed.data.application_number && !parsed.data.email) {
    return NextResponse.json(
      { ok: false, message: "신청번호 또는 이메일이 필요합니다." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("partner_applications")
    .select(
      "id, application_number, status, company_name, applicant_email, access_token_hash, lookup_password_hash, submitted_at, revision_reason"
    )
    .limit(5);

  if (parsed.data.application_number) {
    query = query.eq("application_number", parsed.data.application_number.trim());
  } else if (parsed.data.email) {
    query = query.eq("applicant_email", parsed.data.email.trim().toLowerCase());
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: "신청서를 찾지 못했습니다." }, { status: 500 });
  }

  const hit = (data ?? []).find(
    (row) =>
      row.lookup_password_hash &&
      verifySecret(parsed.data.lookup_password, String(row.lookup_password_hash))
  );

  if (!hit) {
    return NextResponse.json(
      { ok: false, message: "신청 정보를 찾을 수 없거나 비밀번호가 올바르지 않습니다." },
      { status: 404 }
    );
  }

  // Issue a fresh opaque access by verifying hash only — we cannot recover token.
  // Clients that started the flow keep the access_token; lookup returns status only
  // unless they still have the resume link. For resume we need token — store is hash-only.
  // Workaround: rotate access token on successful lookup so user can continue.
  const { generateAccessToken, hashSecret } = await import(
    "@/lib/partner-applications/tokens"
  );
  const newToken = generateAccessToken();
  await supabase
    .from("partner_applications")
    .update({
      access_token_hash: hashSecret(newToken),
      updated_at: new Date().toISOString()
    })
    .eq("id", hit.id);

  return NextResponse.json({
    ok: true,
    application: {
      id: hit.id,
      application_number: hit.application_number,
      status: hit.status,
      company_name: hit.company_name,
      submitted_at: hit.submitted_at,
      revision_reason: hit.revision_reason
    },
    access_token: newToken,
    resume_path: `/partner-apply/${hit.id}?token=${encodeURIComponent(newToken)}`
  });
}
