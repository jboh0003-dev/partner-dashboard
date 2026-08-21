import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  password: z.string().min(1),
  password_confirm: z.string().min(1)
});

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return unauthorizedJson(auth.message);

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "새 비밀번호를 입력해 주세요." }, { status: 400 });
  }
  if (parsed.data.password !== parsed.data.password_confirm) {
    return NextResponse.json({ ok: false, message: "새 비밀번호가 일치하지 않습니다." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("password") && (message.includes("least") || message.includes("short") || message.includes("length"))) {
      return NextResponse.json(
        { ok: false, message: "현재 비밀번호 정책상 더 긴 비밀번호가 필요합니다." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, message: "비밀번호를 변경하지 못했습니다. 다시 시도해 주세요." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
