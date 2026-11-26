import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import {
  computeContractEndDate,
  parsePartnerContractGrade
} from "@/lib/partner-application/contract-dates";
import { generatePartnerContractDocx } from "@/lib/partner-application/generate-contract";

import { renderPartnerContractPdf } from "@/lib/partner-application/generate-contract-pdf";

export const maxDuration = 120;
export const runtime = "nodejs";

const BodySchema = z.object({
  grade: z.string(),
  format: z.enum(["docx", "pdf"]).default("docx"),
  contract_end_date: z.string().date().optional(),
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

    const contractEndDate = body.contract_end_date ?? computeContractEndDate(body.contract_start_date);
    const input = {
      grade,
      companyNameContract: body.company_name_contract,
      ceoName: body.ceo_name,
      businessNumber: body.business_number,
      contractStartDate: body.contract_start_date,
      contractEndDate
    };
    const result = await generatePartnerContractDocx(input);

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    const pdf = body.format === "pdf";
    const filename = pdf ? result.filename.replace(/\.docx$/, ".pdf") : result.filename;
    const bytes = pdf ? await renderPartnerContractPdf(result.buffer) : result.buffer;
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": pdf ? "application/pdf" : result.contentType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
        "X-Contract-Storage": "none"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "계약서 생성 실패";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
