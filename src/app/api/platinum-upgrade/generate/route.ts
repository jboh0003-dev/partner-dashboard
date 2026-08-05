import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { commitPlatinumUpgrade } from "@/lib/platinum-upgrade/commit";

export const runtime = "nodejs";

const BodySchema = z.object({
  partner_id: z.string().uuid(),
  agreement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  company_name: z.string().min(1).optional(),
  confirm_existing_platinum: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return unauthorizedJson(auth.message);

    const json = await request.json();
    const body = BodySchema.parse(json);

    const result = await commitPlatinumUpgrade({
      partnerId: body.partner_id,
      agreementDate: body.agreement_date,
      companyName: body.company_name,
      confirmExistingPlatinum: body.confirm_existing_platinum === true,
      changedByUserId: auth.userId,
      changedByEmail: auth.email
    });

    if (!result.ok) {
      const status = result.code === "ALREADY_PLATINUM" ? 409 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, message: "요청 값이 올바르지 않습니다.", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "플래티넘 승급 처리 실패";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
