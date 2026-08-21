import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { fetchPartnerDeleteImpact } from "@/lib/partners/mutations";
import { createAdminClient } from "@/lib/supabase/admin";

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1)
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "잘못된 요청입니다." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const impact = await fetchPartnerDeleteImpact(supabase, parsed.data.ids);
  return NextResponse.json({ ok: true, impact });
}
