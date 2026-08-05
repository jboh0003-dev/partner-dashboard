import type { SupabaseClient } from "@supabase/supabase-js";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { computeFileHash } from "@/lib/documents/document-lifecycle";
import { buildDocumentStoragePath } from "@/lib/documents/storage-path";
import {
  buildPartnerGradeSavePayload,
  getDisplayPartnerGrade,
  getDisplayPartnerGradeLabel
} from "@/lib/partners/grade";
import { generatePlatinumAgreementPdf } from "@/lib/platinum-upgrade/generate-agreement-pdf";
import { generatePlatinumAgreementDocx } from "@/lib/platinum-upgrade/generate-agreement";
import { resolveFormalCompanyNameForPartner } from "@/lib/platinum-upgrade/formal-company-name";
import { createAdminClient } from "@/lib/supabase/admin";

export const PLATINUM_AGREEMENT_DOCUMENT_TYPE = "platinum_agreement";

export type PlatinumUpgradeCommitInput = {
  partnerId: string;
  agreementDate: string;
  /** 화면에서 수정 가능한 정식 상호. 없으면 서버에서 해석 */
  companyName?: string;
  confirmExistingPlatinum?: boolean;
  changedByUserId: string;
  changedByEmail: string | null;
};

export type PlatinumUpgradeCommitResult =
  | {
      ok: true;
      partner_id: string;
      company_name: string;
      previous_grade: string;
      previous_grade_label: string;
      new_grade: "platinum";
      grade_changed: boolean;
      already_platinum: boolean;
      docx: { filename: string; base64: string; content_type: string; document_id: string };
      pdf: { filename: string; base64: string; content_type: string; document_id: string };
      message: string;
    }
  | {
      ok: false;
      message: string;
      code?: "ALREADY_PLATINUM" | "VALIDATION" | "GENERATE" | "STORAGE" | "GRADE";
      already_platinum?: boolean;
      previous_grade?: string;
      previous_grade_label?: string;
    };

async function saveAgreementDocument(
  supabase: SupabaseClient,
  partnerId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string,
  fileExt: "docx" | "pdf"
): Promise<string> {
  const fileHash = computeFileHash(fileBuffer);
  const { data: existing } = await supabase
    .from("partner_documents")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("document_type", PLATINUM_AGREEMENT_DOCUMENT_TYPE)
    .eq("file_hash", fileHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) {
    return String(existing.id);
  }

  const storagePath = buildDocumentStoragePath(
    partnerId,
    PLATINUM_AGREEMENT_DOCUMENT_TYPE,
    fileExt
  );

  const { error: uploadError } = await supabase.storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .upload(storagePath, fileBuffer, {
      upsert: false,
      contentType
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: inserted, error } = await supabase
    .from("partner_documents")
    .insert({
      partner_id: partnerId,
      document_type: PLATINUM_AGREEMENT_DOCUMENT_TYPE,
      original_filename: fileName,
      file_name: fileName,
      display_name: fileName,
      file_ext: fileExt,
      file_size: fileBuffer.byteLength,
      file_hash: fileHash,
      storage_path: storagePath,
      file_path: storagePath,
      source_file: "platinum_upgrade",
      is_primary: fileExt === "pdf",
      is_active: true,
      match_status: "matched",
      review_status: "auto_matched"
    })
    .select("id")
    .single();

  if (error || !inserted) {
    await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).remove([storagePath]);
    throw new Error(error?.message ?? "플래티넘 부속합의서 문서 저장 실패");
  }

  return String(inserted.id);
}

export async function commitPlatinumUpgrade(
  input: PlatinumUpgradeCommitInput
): Promise<PlatinumUpgradeCommitResult> {
  const supabase = createAdminClient();

  const { data: partner, error: partnerError } = await supabase
    .from("partners")
    .select(
      "id, company_name, contract_display_name, business_number, ceo_name, grade, grade_override, grade_change_raw, grade_original, deleted_at, is_active"
    )
    .eq("id", input.partnerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (partnerError) {
    return { ok: false, message: partnerError.message, code: "VALIDATION" };
  }
  if (!partner) {
    return { ok: false, message: "파트너를 찾을 수 없습니다.", code: "VALIDATION" };
  }

  const formal =
    input.companyName?.trim() ||
    (
      await resolveFormalCompanyNameForPartner(supabase, input.partnerId, partner)
    )?.name ||
    "";
  const companyName = formal.trim();
  const businessNumber = partner.business_number ? String(partner.business_number) : "";
  const ceoName = partner.ceo_name ? String(partner.ceo_name) : "";

  if (!companyName) {
    return { ok: false, message: "파트너 상호(회사명)가 비어 있습니다.", code: "VALIDATION" };
  }
  if (!businessNumber) {
    return {
      ok: false,
      message: "파트너 사업자등록번호가 비어 있습니다. 파트너 기본정보를 먼저 보완해 주세요.",
      code: "VALIDATION"
    };
  }
  if (!ceoName) {
    return {
      ok: false,
      message: "파트너 대표이사(ceo_name)가 비어 있습니다. 파트너 기본정보를 먼저 보완해 주세요.",
      code: "VALIDATION"
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.agreementDate)) {
    return {
      ok: false,
      message: "문서 마지막 계약일은 YYYY-MM-DD 형식이어야 합니다.",
      code: "VALIDATION"
    };
  }

  const previousGrade = getDisplayPartnerGrade(partner);
  const previousGradeLabel = getDisplayPartnerGradeLabel(partner);
  const alreadyPlatinum = previousGrade === "platinum";

  // 이미 Platinum이어도 문서 생성은 허용 (등급만 유지)

  const docxResult = await generatePlatinumAgreementDocx({
    companyName,
    ceoName,
    businessNumber,
    agreementDate: input.agreementDate
  });
  if (!docxResult.ok) {
    return { ok: false, message: docxResult.message, code: "GENERATE" };
  }

  const pdfResult = await generatePlatinumAgreementPdf(
    {
      companyName,
      ceoName,
      businessNumber,
      agreementDate: input.agreementDate
    },
    docxResult.buffer
  );
  if (!pdfResult.ok) {
    return { ok: false, message: pdfResult.message, code: "GENERATE" };
  }

  let docxDocumentId: string;
  let pdfDocumentId: string;
  try {
    docxDocumentId = await saveAgreementDocument(
      supabase,
      input.partnerId,
      docxResult.filename,
      docxResult.buffer,
      docxResult.contentType,
      "docx"
    );
    pdfDocumentId = await saveAgreementDocument(
      supabase,
      input.partnerId,
      pdfResult.filename,
      pdfResult.buffer,
      pdfResult.contentType,
      "pdf"
    );
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "문서 업로드 실패",
      code: "STORAGE"
    };
  }

  let gradeChanged = false;
  if (!alreadyPlatinum) {
    const gradeSave = buildPartnerGradeSavePayload("platinum");
    const { error: gradeError } = await supabase
      .from("partners")
      .update({
        grade: gradeSave.grade,
        grade_override: gradeSave.grade_override,
        updated_at: new Date().toISOString()
      })
      .eq("id", input.partnerId);

    if (gradeError) {
      return {
        ok: false,
        message: `문서는 저장되었으나 등급 변경에 실패했습니다: ${gradeError.message}`,
        code: "GRADE"
      };
    }
    gradeChanged = true;

    const { error: historyError } = await supabase.from("partner_grade_history").insert({
      partner_id: input.partnerId,
      previous_grade: previousGrade === "none" ? null : previousGrade,
      new_grade: "platinum",
      changed_at: new Date().toISOString(),
      changed_by: input.changedByUserId,
      changed_by_email: input.changedByEmail,
      note: "플래티넘 부속합의서 생성에 따른 자동 승급"
    });

    if (historyError) {
      return {
        ok: false,
        message: `등급은 변경되었으나 이력 기록에 실패했습니다: ${historyError.message}`,
        code: "GRADE"
      };
    }
  }

  return {
    ok: true,
    partner_id: input.partnerId,
    company_name: companyName,
    previous_grade: previousGrade,
    previous_grade_label: previousGradeLabel,
    new_grade: "platinum",
    grade_changed: gradeChanged,
    already_platinum: alreadyPlatinum,
    docx: {
      filename: docxResult.filename,
      base64: docxResult.buffer.toString("base64"),
      content_type: docxResult.contentType,
      document_id: docxDocumentId
    },
    pdf: {
      filename: pdfResult.filename,
      base64: pdfResult.buffer.toString("base64"),
      content_type: pdfResult.contentType,
      document_id: pdfDocumentId
    },
    message: alreadyPlatinum
      ? "이미 Platinum인 파트너입니다. 부속합의서 문서를 생성·저장했습니다. (등급 변경 없음)"
      : "플래티넘 부속합의서를 생성하고 등급을 Platinum으로 변경했습니다."
  };
}
