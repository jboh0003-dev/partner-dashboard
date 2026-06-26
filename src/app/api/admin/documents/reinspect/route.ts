import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { buildDocumentReinspectUpdate } from "@/lib/documents/reinspect";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = createAdminClient();

    const [{ data: documents, error: documentError }, { data: partners, error: partnerError }] =
      await Promise.all([
        supabase
          .from("partner_documents")
          .select(
            "id, partner_id, original_filename, file_name, source_folder, source_file, document_type, display_name, contract_date, grade_from_file, partner_no, partner_name_raw, match_method, match_confidence, review_status, period_year, partners!inner(company_name)"
          )
          .is("deleted_at", null),
        supabase.from("partners").select("id, company_name, external_no")
      ]);

    if (documentError) throw new Error(documentError.message);
    if (partnerError) throw new Error(partnerError.message);

    const partnerRows =
      partners?.map((row) => ({
        id: String(row.id),
        company_name: String(row.company_name),
        external_no: (row.external_no as string | null) ?? null
      })) ?? [];

    let updated = 0;
    let skipped = 0;
    let needsReview = 0;

    for (const row of documents ?? []) {
      const partnersRel = row.partners as { company_name: string } | { company_name: string }[];
      const partner = Array.isArray(partnersRel) ? partnersRel[0] : partnersRel;

      const payload = buildDocumentReinspectUpdate(
        {
          id: String(row.id),
          partner_id: String(row.partner_id),
          partner_name: partner?.company_name ?? "",
          original_filename: (row.original_filename as string | null) ?? null,
          file_name: String(row.file_name ?? row.original_filename ?? ""),
          source_folder: (row.source_folder as string | null) ?? null,
          source_file: (row.source_file as string | null) ?? null,
          document_type: (row.document_type as string | null) ?? null,
          display_name: (row.display_name as string | null) ?? null,
          contract_date: (row.contract_date as string | null) ?? null,
          grade_from_file: (row.grade_from_file as string | null) ?? null,
          partner_no: (row.partner_no as string | null) ?? null,
          partner_name_raw: (row.partner_name_raw as string | null) ?? null,
          match_method: (row.match_method as string | null) ?? null,
          match_confidence: (row.match_confidence as number | null) ?? null,
          review_status: (row.review_status as string | null) ?? null,
          period_year: (row.period_year as number | null) ?? null
        },
        partnerRows
      );

      if (!payload) {
        skipped += 1;
        continue;
      }

      const { error } = await supabase
        .from("partner_documents")
        .update({
          document_type: payload.document_type,
          display_name: payload.display_name,
          file_name: payload.display_name,
          extracted_partner_name: payload.extracted_partner_name,
          partner_name_raw: payload.partner_name_raw,
          contract_date: payload.contract_date,
          grade_from_file: payload.grade_from_file,
          match_status: payload.match_status,
          match_confidence: payload.match_confidence,
          match_method: payload.match_method,
          review_status: payload.review_status,
          updated_at: new Date().toISOString()
        })
        .eq("id", payload.id);

      if (error) continue;

      updated += 1;
      if (payload.match_status === "needs_review") needsReview += 1;
    }

    revalidatePath("/dashboard/documents");

    return NextResponse.json({
      ok: true,
      updated,
      skipped,
      needs_review: needsReview
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "문서 매칭 재검사 실패"
      },
      { status: 400 }
    );
  }
}
