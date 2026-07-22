import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import {
  computeContractEndDate,
  parsePartnerContractGrade
} from "@/lib/partner-application/contract-dates";
import { generatePartnerContractDocx } from "@/lib/partner-application/generate-contract";

export const runtime = "nodejs";

const BodySchema = z.object({
  grade: z.string(),
  company_name_contract: z.string().min(1),
  ceo_name: z.string().min(1),
  business_number: z.string().min(1),
  contract_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function POST(request: Request) {
  try {
    const auth = await requireUser();
    if (!auth.ok) return unauthorizedJson(auth.message);

    const json = await request.json();
    const body = BodySchema.parse(json);
    const grade = parsePartnerContractGrade(body.grade);
    if (!grade) {
      return NextResponse.json(
        { ok: false, message: "계약등급은 실버/골드/플래티넘만 지원합니다." },
        { status: 400 }
      );
    }

    const contractEndDate = computeContractEndDate(body.contract_start_date);
    const result = await generatePartnerContractDocx({
      grade,
      companyNameContract: body.company_name_contract,
      ceoName: body.ceo_name,
      businessNumber: body.business_number,
      contractStartDate: body.contract_start_date,
      contractEndDate
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
        "Cache-Control": "no-store",
        "X-Contract-Storage": "none"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "계약서 생성 실패";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
