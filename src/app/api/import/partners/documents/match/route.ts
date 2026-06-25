import { NextResponse } from "next/server";
import { z } from "zod";
import { DOCUMENT_TYPES } from "@/lib/documents/constants";
import type { ParsedPartnerDocumentFile } from "@/lib/documents/parse-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  analyzePartnerDocumentRows,
  type PartnerDocumentDbRow,
  type PartnerDocumentPartnerRow
} from "@/lib/imports/partner-documents";

const ParsedRowSchema = z.object({
  row_number: z.number().int(),
  client_key: z.string(),
  original_filename: z.string(),
  display_name: z.string(),
  relative_path: z.string(),
  source_folder: z.string(),
  source_folder_name: z.string().nullable().optional(),
  folder_match_candidates: z.array(z.string()).optional().default([]),
  folder_normalized_name: z.string().nullable().optional(),
  is_generic_folder: z.boolean().optional().default(false),
  filename_partner_name: z.string().nullable().optional(),
  filename_partner_candidates: z.array(z.string()).optional().default([]),
  source_file: z.string(),
  file_ext: z.string(),
  file_size: z.number(),
  document_type: z.enum(DOCUMENT_TYPES),
  partner_name_raw: z.string().nullable(),
  partner_name_source: z.enum(["folder", "filename"]).nullable(),
  normalized_company_name: z.string().nullable(),
  contract_date: z.string().nullable(),
  received_date: z.string().nullable(),
  partner_no: z.string().nullable(),
  grade_from_file: z.string().nullable(),
  period_year: z.number().nullable(),
  period_quarter: z.string().nullable(),
  period_month: z.number().nullable(),
  note: z.string().nullable()
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const rows = z.array(ParsedRowSchema).parse(json.rows);
    const supabase = createAdminClient();

    const [{ data: partners, error: partnerError }, { data: documents, error: documentError }] =
      await Promise.all([
        supabase.from("partners").select("id, company_name, external_no").order("company_name"),
        supabase
          .from("partner_documents")
          .select(
            "id, partner_id, document_type, original_filename, file_name, file_size, is_active, is_duplicate"
          )
          .is("deleted_at", null)
      ]);

    if (partnerError) throw new Error(partnerError.message);
    if (documentError) throw new Error(documentError.message);

    const analysis = analyzePartnerDocumentRows(
      rows as ParsedPartnerDocumentFile[],
      (partners ?? []) as PartnerDocumentPartnerRow[],
      (documents ?? []) as PartnerDocumentDbRow[]
    );

    return NextResponse.json({
      ok: true,
      items: analysis.items,
      summary: analysis.summary,
      partners: (partners ?? []).map((partner) => ({
        id: partner.id,
        company_name: partner.company_name,
        external_no: partner.external_no
      }))
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "문서 미리보기 실패"
      },
      { status: 400 }
    );
  }
}
