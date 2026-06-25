"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type SavePartnerDocumentRematchInput = {
  documentId: string;
  partnerId: string;
  documentType: string;
  displayName: string | null;
  contractDate: string | null;
  grade: string | null;
  note: string | null;
};

export async function savePartnerDocumentRematch(input: SavePartnerDocumentRematchInput) {
  if (!input.partnerId?.trim()) {
    return { ok: false as const, message: "파트너사를 선택해 주세요." };
  }
  if (!input.documentType?.trim()) {
    return { ok: false as const, message: "문서 구분을 선택해 주세요." };
  }

  const supabase = createAdminClient();

  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select("id, company_name")
    .eq("id", input.partnerId)
    .single();

  if (partnerError || !partner) {
    return { ok: false as const, message: "파트너를 찾을 수 없습니다." };
  }

  const { data: document, error: documentError } = await supabase
    .from("partner_documents")
    .select("id, partner_id, deleted_at, is_duplicate")
    .eq("id", input.documentId)
    .single();

  if (documentError || !document || document.deleted_at) {
    return { ok: false as const, message: "문서를 찾을 수 없습니다." };
  }

  const previousPartnerId = String(document.partner_id);

  const { error } = await supabase
    .from("partner_documents")
    .update({
      partner_id: input.partnerId,
      document_type: input.documentType.trim(),
      display_name: input.displayName,
      contract_date: input.contractDate,
      grade_from_file: input.grade,
      note: input.note,
      match_status: "matched",
      match_method: "manual",
      match_confidence: 100,
      match_source: "manual",
      review_status: "auto_matched",
      partner_name_raw: partner.company_name,
      is_active: true,
      ...(document.is_duplicate ? {} : { duplicate_reason: null }),
      updated_at: new Date().toISOString()
    })
    .eq("id", input.documentId);

  if (error) {
    return { ok: false as const, message: error.message };
  }

  revalidatePath("/dashboard/documents");
  revalidatePath(`/dashboard/partners/${input.partnerId}`);
  if (previousPartnerId !== input.partnerId) {
    revalidatePath(`/dashboard/partners/${previousPartnerId}`);
  }

  return { ok: true as const, partnerName: partner.company_name };
}

/** @deprecated savePartnerDocumentRematch 사용 */
export async function rematchPartnerDocument(documentId: string, partnerId: string) {
  return savePartnerDocumentRematch({
    documentId,
    partnerId,
    documentType: "other",
    displayName: null,
    contractDate: null,
    grade: null,
    note: null
  });
}
