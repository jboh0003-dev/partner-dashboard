import { NextResponse } from "next/server";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildApplicationExcelFileName,
  fillPartnerApplicationExcel
} from "@/lib/partner-applications/excel-fill";
import type { PartnerApplicationFormPayload } from "@/lib/partner-applications/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return unauthorizedJson(auth.message);

  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("company_name, form_payload")
    .eq("id", id)
    .maybeSingle();
  if (error || !app) {
    return NextResponse.json({ ok: false, message: "신청서를 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const form = app.form_payload as PartnerApplicationFormPayload;
    const buffer = await fillPartnerApplicationExcel(form);
    const fileName = buildApplicationExcelFileName(String(app.company_name || "미기재"));
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Excel 생성 실패" },
      { status: 500 }
    );
  }
}
