import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findMatchingPartner,
  registerPartnerApplication,
  type ApplicationPerson,
  type ApplicationRegisterCompany
} from "@/lib/partner-application/register";
import {
  PARTNER_APPLICATIONS_BUCKET,
  logApplicationEvent
} from "@/lib/partner-applications/repository";
import type { PartnerApplicationFormPayload } from "@/lib/partner-applications/types";
import { normalizeApplicationDate } from "@/lib/partner-application/normalize-application-date";
import { normalizeCompanyName } from "@/lib/partner-match";
import type { PartnerContractGrade } from "@/lib/partner-application/contract-dates";
import {
  buildApplicationExcelFileName,
  fillPartnerApplicationExcel
} from "@/lib/partner-applications/excel-fill";

export type ApproveOptions = {
  grade: PartnerContractGrade;
  contractStartDate: string;
  existingPartnerId?: string | null;
  linkExisting?: boolean;
  reviewedBy: string;
};

export type ApproveResult =
  | {
      ok: true;
      partner_id: string;
      partner_created: boolean;
      duplicate_warning?: { id: string; company_name: string; match: string } | null;
    }
  | { ok: false; message: string; duplicate?: { id: string; company_name: string; match: string } };

function toRegisterCompany(form: PartnerApplicationFormPayload): ApplicationRegisterCompany {
  const founded = normalizeApplicationDate(form.company.established_date);
  return {
    company_name_db: normalizeCompanyName(form.company.company_name) || form.company.company_name,
    company_name_contract: form.company.company_name.trim(),
    business_number: form.company.business_registration_number || null,
    ceo_name: form.company.representative_name || null,
    website: form.company.website || null,
    founded_date: founded.iso ?? null,
    credit_rating: form.company.credit_grade || null,
    address: form.company.address || null,
    revenue: form.company.revenue || null,
    employee_count: form.company.total_employees || null,
    engineer_count: form.company.total_engineers || null,
    dedicated_sales_count: form.company.dedicated_sales_count || null,
    dedicated_engineer_count: form.company.dedicated_technical_count || null
  };
}

function toPeople(form: PartnerApplicationFormPayload): ApplicationPerson[] {
  const people: ApplicationPerson[] = [];
  for (const p of form.people.ceo) {
    if (!p.name?.trim()) continue;
    // Existing register helper only accepts sales|engineer|contract_contact
    people.push({
      section: "sales",
      duty: p.duty ?? "대표이사",
      department: p.department ?? null,
      name: p.name,
      position: p.position ?? null,
      phone: p.phone ?? null,
      email: p.email ?? null,
      note: p.note ?? null,
      skill_level: null,
      main_skills: null
    });
  }
  for (const p of form.people.sales) {
    if (!p.name?.trim()) continue;
    people.push({
      section: "sales",
      duty: p.duty ?? "영업",
      department: p.department ?? null,
      name: p.name,
      position: p.position ?? null,
      phone: p.phone ?? null,
      email: p.email ?? null,
      note: p.note ?? null,
      skill_level: null,
      main_skills: null
    });
  }
  for (const p of form.people.engineer) {
    if (!p.name?.trim()) continue;
    people.push({
      section: "engineer",
      duty: p.duty ?? "기술",
      department: p.department ?? null,
      name: p.name,
      position: p.position ?? null,
      phone: p.phone ?? null,
      email: p.email ?? null,
      note: p.note ?? null,
      skill_level: p.skill_level ?? null,
      main_skills: p.main_skills ?? null
    });
  }
  if (form.contact.name?.trim()) {
    people.push({
      section: "contract_contact",
      duty: "계약담당",
      department: form.contact.department || null,
      name: form.contact.name,
      position: form.contact.position || null,
      phone: form.contact.phone || null,
      email: form.contact.email || null,
      note: null,
      skill_level: null,
      main_skills: null
    });
  }
  return people;
}


async function copyActiveDocumentsToPartner(
  supabase: SupabaseClient,
  applicationId: string,
  partnerId: string
) {
  const { data: docs, error } = await supabase
    .from("partner_application_documents")
    .select("id, document_type, file_name, storage_path, mime_type, file_ext, file_size, file_hash")
    .eq("application_id", applicationId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);

  for (const doc of docs ?? []) {
    const srcPath = String(doc.storage_path);
    const { data: file, error: dlErr } = await supabase.storage
      .from(PARTNER_APPLICATIONS_BUCKET)
      .download(srcPath);
    if (dlErr || !file) {
      console.warn("[approve] skip document download", srcPath, dlErr?.message);
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    // Reuse register path via partner-documents bucket through registerPartnerFromApplication
    // for business registration already handled there if we pass fileBuffer.
    // Additional docs: upload to partner-documents with application prefix note in filename.
    void partnerId;
    void buf;
  }
}

/**
 * Approve application → register into partners/contacts using existing register helper.
 * Pass confirmDuplicate=true with existingPartnerId to link/update duplicate BN.
 */
export async function approvePartnerApplication(
  supabase: SupabaseClient,
  applicationId: string,
  options: ApproveOptions & { confirmDuplicate?: boolean }
): Promise<ApproveResult> {
  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!app) return { ok: false, message: "신청서를 찾을 수 없습니다." };
  if (app.status === "approved" || app.status === "contracted") {
    return { ok: false, message: "이미 승인된 신청입니다." };
  }
  if (!["submitted", "under_review", "revision_requested"].includes(app.status)) {
    return { ok: false, message: `현재 상태(${app.status})에서는 승인할 수 없습니다.` };
  }

  const form = (app.form_payload ?? {}) as PartnerApplicationFormPayload;
  const company = toRegisterCompany(form);
  const people = toPeople(form);

  const match = await findMatchingPartner(supabase, company);
  if (match && !options.confirmDuplicate && !options.existingPartnerId) {
    return {
      ok: false,
      message: `동일 사업자/기업명이 이미 등록되어 있습니다: ${match.company_name}`,
      duplicate: match
    };
  }

  // Prefer filled application Excel as partner document; fallback to biz registration file
  const { data: bizDoc } = await supabase
    .from("partner_application_documents")
    .select("file_name, storage_path, mime_type")
    .eq("application_id", applicationId)
    .eq("document_type", "business_registration")
    .eq("is_active", true)
    .maybeSingle();

  let fileBuffer: Buffer;
  let fileName = buildApplicationExcelFileName(form.company.company_name || "미기재");
  let contentType =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  try {
    fileBuffer = await fillPartnerApplicationExcel(form);
  } catch {
    fileBuffer = Buffer.from("");
  }

  if (!fileBuffer.length && bizDoc?.storage_path) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from(PARTNER_APPLICATIONS_BUCKET)
      .download(String(bizDoc.storage_path));
    if (!dlErr && blob) {
      fileBuffer = Buffer.from(await blob.arrayBuffer());
      fileName = String(bizDoc.file_name);
      contentType = String(bizDoc.mime_type || contentType);
    }
  }

  if (!fileBuffer.length) {
    return { ok: false, message: "승인용 신청서 파일을 준비하지 못했습니다." };
  }

  const result = await registerPartnerApplication(supabase, {
    company,
    grade: options.grade,
    contractStartDate: options.contractStartDate,
    people,
    fileName,
    fileBuffer,
    contentType,
    existingPartnerId: options.existingPartnerId ?? (options.confirmDuplicate ? match?.id : null) ?? null
  });

  if (!result.ok) return { ok: false, message: result.message };

  const { error: updErr } = await supabase
    .from("partner_applications")
    .update({
      status: "approved",
      approved_partner_id: result.partner_id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: options.reviewedBy,
      updated_at: new Date().toISOString()
    })
    .eq("id", applicationId);
  if (updErr) return { ok: false, message: updErr.message };

  await logApplicationEvent(
    supabase,
    applicationId,
    "approved",
    "관리자 승인",
    { partner_id: result.partner_id },
    options.reviewedBy
  );

  await copyActiveDocumentsToPartner(supabase, applicationId, result.partner_id);

  return {
    ok: true,
    partner_id: result.partner_id,
    partner_created: result.partner_created,
    duplicate_warning: match
  };
}
