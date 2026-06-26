import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseTechPartnerExamWorkbook } from "@/lib/excel/parse-tech-partner-exam";
import { parseTechPartnerRosterWorkbook } from "@/lib/excel/parse-tech-partner-roster";
import { analyzeTechPartnerTrainingUpload } from "@/lib/imports/tech-partner-training";
import * as XLSX from "xlsx";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const examFile = formData.get("exam_file");
    const rosterFile = formData.get("roster_file");

    if (!(examFile instanceof File) || !(rosterFile instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "시험결과 파일과 교육생 관리대장 파일을 모두 선택해 주세요." },
        { status: 400 }
      );
    }

    const [examBuffer, rosterBuffer] = await Promise.all([
      examFile.arrayBuffer(),
      rosterFile.arrayBuffer()
    ]);

    const examWorkbook = XLSX.read(examBuffer, { type: "array", cellDates: false });
    const rosterWorkbook = XLSX.read(rosterBuffer, { type: "array", cellDates: false });

    const examParsed = parseTechPartnerExamWorkbook(examWorkbook, examFile.name);
    const rosterParsed = parseTechPartnerRosterWorkbook(rosterWorkbook, rosterFile.name);

    if (examParsed.rows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "시험결과 파일에서 데이터를 찾지 못했습니다." },
        { status: 400 }
      );
    }
    if (rosterParsed.rows.length === 0) {
      return NextResponse.json(
        { ok: false, message: "교육생 관리대장 출석부에서 데이터를 찾지 못했습니다." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const [{ data: partners }, { data: contacts }] = await Promise.all([
      supabase.from("partners").select("id, company_name"),
      supabase.from("partner_contacts").select("id, partner_id, name, email, phone, position, role_type")
    ]);

    const analysis = analyzeTechPartnerTrainingUpload({
      examRows: examParsed.rows,
      rosterRows: rosterParsed.rows,
      partners: (partners ?? []).map((p) => ({
        id: String(p.id),
        company_name: String(p.company_name)
      })),
      contacts: (contacts ?? []).map((c) => ({
        id: String(c.id),
        partner_id: String(c.partner_id),
        name: String(c.name),
        email: (c.email as string | null) ?? null,
        phone: (c.phone as string | null) ?? null,
        position: (c.position as string | null) ?? null,
        role_type: (c.role_type as string | null) ?? null
      }))
    });

    return NextResponse.json({
      ok: true,
      exam_sheet: examParsed.sheet_name,
      roster_sheet: rosterParsed.sheet_name,
      ...analysis
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "분석에 실패했습니다."
      },
      { status: 400 }
    );
  }
}
