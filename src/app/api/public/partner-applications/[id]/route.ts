import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerApplicationFormPayload } from "@/lib/partner-applications/types";
import { verifySecret } from "@/lib/partner-applications/tokens";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/partner-applications/rate-limit";
import {
  logApplicationEvent,
  saveApplicationForm
} from "@/lib/partner-applications/repository";

export const runtime = "nodejs";

const PatchSchema = z.object({
  token: z.string().min(10),
  form: z.record(z.string(), z.unknown()),
  honeypot: z.string().optional()
});

type Ctx = { params: Promise<{ id: string }> };

async function loadAuthorized(
  id: string,
  token: string
): Promise<
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; status: number; message: string }
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partner_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, status: 500, message: "신청서를 불러오지 못했습니다." };
  if (!data) return { ok: false, status: 404, message: "신청서를 찾을 수 없습니다." };
  if (!verifySecret(token, String(data.access_token_hash))) {
    return { ok: false, status: 403, message: "수정 권한이 없습니다." };
  }
  return { ok: true, row: data as Record<string, unknown> };
}

export async function GET(request: Request, context: Ctx) {
  const { id } = await context.params;
  const ip = clientIpFromHeaders(request.headers);
  const limited = checkRateLimit(`pa-get:${ip}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다." }, { status: 429 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ ok: false, message: "접근 권한이 없습니다." }, { status: 400 });
  }

  const auth = await loadAuthorized(id, token);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data: documents } = await supabase
    .from("partner_application_documents")
    .select("id, document_type, file_name, file_size, mime_type, is_active, created_at")
    .eq("application_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    ok: true,
    application: {
      id: auth.row.id,
      application_number: auth.row.application_number,
      status: auth.row.status,
      form: auth.row.form_payload,
      missing_required_count: auth.row.missing_required_count,
      revision_reason: auth.row.revision_reason,
      submitted_at: auth.row.submitted_at,
      documents: documents ?? []
    }
  });
}

export async function PATCH(request: Request, context: Ctx) {
  const { id } = await context.params;
  const ip = clientIpFromHeaders(request.headers);
  const limited = checkRateLimit(`pa-patch:${ip}`, 40, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, message: "요청이 너무 많습니다." }, { status: 429 });
  }

  const json = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }
  if (parsed.data.honeypot) {
    return NextResponse.json({ ok: true });
  }

  const auth = await loadAuthorized(id, parsed.data.token);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const status = String(auth.row.status);
  if (!["draft", "revision_requested"].includes(status)) {
    return NextResponse.json(
      { ok: false, message: "현재 상태에서는 수정할 수 없습니다." },
      { status: 409 }
    );
  }

  const form = parsed.data.form as unknown as PartnerApplicationFormPayload;
  const supabase = createAdminClient();
  try {
    const { missing } = await saveApplicationForm(supabase, id, form);
    await logApplicationEvent(supabase, id, "draft_saved", "임시저장");
    return NextResponse.json({
      ok: true,
      missing_required_count: missing.length,
      missing
    });
  } catch (e) {
    return NextResponse.json({ ok: false, message: "저장에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}
