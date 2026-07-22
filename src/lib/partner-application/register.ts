import type { SupabaseClient } from "@supabase/supabase-js";
import { syncContactDetails } from "@/lib/contacts/contact-details";
import { normalizePersonName } from "@/lib/contacts/person-key";
import { normalizePhoneInput } from "@/lib/contacts/phone-normalize";
import { PARTNER_DOCUMENTS_BUCKET } from "@/lib/documents/constants";
import { computeFileHash } from "@/lib/documents/document-lifecycle";
import { buildDocumentStoragePath } from "@/lib/documents/storage-path";
import {
  normalizeBusinessNumber,
  normalizeCompanyName
} from "@/lib/partner-match";
import type { ApplicationPerson } from "@/lib/partner-application/parse-application";
import {
  computeContractEndDate,
  formatBusinessNumberDisplay,
  type PartnerContractGrade
} from "@/lib/partner-application/contract-dates";
import {
  FOUNDED_DATE_FORMAT_HINT,
  normalizeApplicationDate
} from "@/lib/partner-application/normalize-application-date";

export type { ApplicationPerson };

export const PARTNER_APPLICATION_CONTACT_SOURCE = "partner_application";

export type ApplicationRegisterCompany = {
  company_name_db: string;
  company_name_contract: string;
  business_number: string | null;
  ceo_name: string | null;
  website: string | null;
  founded_date: string | null;
  credit_rating: string | null;
  address: string | null;
  revenue: string | null;
  employee_count: string | null;
  engineer_count: string | null;
  dedicated_sales_count: string | null;
  dedicated_engineer_count: string | null;
};

export type ApplicationRegisterInput = {
  company: ApplicationRegisterCompany;
  grade: PartnerContractGrade;
  contractStartDate: string;
  people: ApplicationPerson[];
  fileName: string;
  fileBuffer: Buffer;
  contentType?: string;
  existingPartnerId?: string | null;
  updateFields?: string[];
};

export type ApplicationRegisterResult =
  | {
      ok: true;
      partner_id: string;
      partner_created: boolean;
      external_no: string | null;
      contacts_created: number;
      contacts_updated: number;
      document_id: string | null;
      document_reused: boolean;
      warnings: string[];
    }
  | { ok: false; message: string };

async function allocateNextExternalNo(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase
    .from("partners")
    .select("external_no")
    .is("deleted_at", null)
    .not("external_no", "is", null)
    .limit(5000);
  if (error) throw new Error(error.message);
  let max = 0;
  for (const row of data ?? []) {
    const n = Number(String(row.external_no).replace(/\D/g, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

export async function findMatchingPartner(
  supabase: SupabaseClient,
  company: ApplicationRegisterCompany
): Promise<{ id: string; company_name: string; match: "business_number" | "company_name" } | null> {
  const bn = normalizeBusinessNumber(company.business_number);
  if (bn) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name, business_number")
      .is("deleted_at", null)
      .limit(2000);
    const hit = (data ?? []).find(
      (row) => normalizeBusinessNumber(row.business_number as string | null) === bn
    );
    if (hit) {
      return {
        id: String(hit.id),
        company_name: String(hit.company_name),
        match: "business_number"
      };
    }
  }

  const normalized = normalizeCompanyName(company.company_name_db);
  if (normalized) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .is("deleted_at", null)
      .limit(2000);
    const hit = (data ?? []).find(
      (row) => normalizeCompanyName(row.company_name as string) === normalized
    );
    if (hit) {
      return {
        id: String(hit.id),
        company_name: String(hit.company_name),
        match: "company_name"
      };
    }
  }

  return null;
}

type MergedPerson = {
  name: string;
  department: string | null;
  position: string | null;
  emails: string[];
  phones: string[];
  is_contract_contact: boolean;
  role_types: Set<string>;
  role_labels: Set<string>;
  memo: string | null;
};

function mergePeople(people: ApplicationPerson[]): MergedPerson[] {
  const map = new Map<string, MergedPerson>();

  for (const person of people) {
    if (person.excluded) continue;
    const name = person.name.trim();
    if (!name) continue;
    const key = normalizePersonName(name);
    const existing = map.get(key);
    const phone = normalizePhoneInput(person.phone);
    const email = person.email?.trim().toLowerCase() || null;
    const displayPhone = phone?.display_phone ?? (person.phone?.trim() || null);

    const roleType =
      person.section === "contract_contact"
        ? "contract"
        : person.section === "sales"
          ? "sales"
          : "engineer";
    const roleLabel =
      person.section === "contract_contact"
        ? "계약담당자"
        : person.section === "sales"
          ? "영업"
          : "엔지니어";

    if (!existing) {
      map.set(key, {
        name,
        department: person.department,
        position: person.position,
        emails: email ? [email] : [],
        phones: displayPhone ? [displayPhone] : [],
        is_contract_contact: person.section === "contract_contact",
        role_types: new Set([roleType]),
        role_labels: new Set([roleLabel]),
        memo: person.note
      });
      continue;
    }

    if (!existing.department && person.department) existing.department = person.department;
    if (!existing.position && person.position) existing.position = person.position;
    if (email && !existing.emails.includes(email)) existing.emails.push(email);
    if (displayPhone && !existing.phones.includes(displayPhone)) {
      existing.phones.push(displayPhone);
    }
    if (person.section === "contract_contact") existing.is_contract_contact = true;
    existing.role_types.add(roleType);
    existing.role_labels.add(roleLabel);
    if (!existing.memo && person.note) existing.memo = person.note;
  }

  return [...map.values()];
}

async function upsertContact(
  supabase: SupabaseClient,
  partnerId: string,
  person: MergedPerson,
  sourceFile: string
): Promise<"created" | "updated"> {
  const { data: existingRows } = await supabase
    .from("partner_contacts")
    .select("id, name, email, phone")
    .eq("partner_id", partnerId)
    .is("deleted_at", null)
    .is("merged_into_contact_id", null);

  const nameKey = normalizePersonName(person.name);
  let matched =
    (existingRows ?? []).find((row) => normalizePersonName(row.name as string) === nameKey) ??
    null;

  if (!matched && person.emails[0]) {
    matched =
      (existingRows ?? []).find(
        (row) => String(row.email ?? "").trim().toLowerCase() === person.emails[0]
      ) ?? null;
  }

  const primaryRole = person.role_types.has("contract")
    ? "contract"
    : person.role_types.has("sales")
      ? "sales"
      : person.role_types.has("engineer")
        ? "engineer"
        : "etc";

  const payload = {
    partner_id: partnerId,
    name: person.name,
    department: person.department,
    position: person.position,
    email: person.emails[0] ?? null,
    phone: person.phones[0] ?? null,
    role_type: primaryRole,
    role_raw: [...person.role_labels].join(", "),
    is_contract_contact: person.is_contract_contact,
    is_active: true,
    in_current_full_db: true,
    contact_source: PARTNER_APPLICATION_CONTACT_SOURCE,
    source_file: sourceFile,
    memo: person.memo,
    deleted_at: null,
    merged_into_contact_id: null,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  let contactId: string;
  let action: "created" | "updated";

  if (matched) {
    const { error } = await supabase
      .from("partner_contacts")
      .update(payload)
      .eq("id", matched.id);
    if (error) throw new Error(error.message);
    contactId = String(matched.id);
    action = "updated";
  } else {
    const { data, error } = await supabase
      .from("partner_contacts")
      .insert(payload)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "담당자 생성 실패");
    contactId = String(data.id);
    action = "created";
  }

  for (const email of person.emails) {
    await syncContactDetails(supabase, {
      contact_id: contactId,
      email,
      source: sourceFile,
      prefer_upload_email_as_primary: email === person.emails[0],
      role_labels: [...person.role_labels]
    });
  }
  for (const phone of person.phones) {
    await syncContactDetails(supabase, {
      contact_id: contactId,
      phone,
      source: sourceFile,
      prefer_upload_phone_as_primary: phone === person.phones[0]
    });
  }
  if (person.emails.length === 0 && person.phones.length === 0) {
    await syncContactDetails(supabase, {
      contact_id: contactId,
      role_labels: [...person.role_labels],
      source: sourceFile
    });
  }

  return action;
}

async function saveApplicationDocument(
  supabase: SupabaseClient,
  partnerId: string,
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ document_id: string; reused: boolean }> {
  const fileHash = computeFileHash(fileBuffer);
  const { data: existing } = await supabase
    .from("partner_documents")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("document_type", "partner_application")
    .eq("file_hash", fileHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing?.id) {
    return { document_id: String(existing.id), reused: true };
  }

  const ext = fileName.split(".").pop()?.toLowerCase() || "xlsx";
  const storagePath = buildDocumentStoragePath(partnerId, "partner_application", ext);

  const { error: uploadError } = await supabase.storage
    .from(PARTNER_DOCUMENTS_BUCKET)
    .upload(storagePath, fileBuffer, {
      upsert: false,
      contentType: contentType || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  if (uploadError) throw new Error(uploadError.message);

  const { data: inserted, error } = await supabase
    .from("partner_documents")
    .insert({
      partner_id: partnerId,
      document_type: "partner_application",
      original_filename: fileName,
      file_name: fileName,
      display_name: fileName,
      file_ext: ext,
      file_size: fileBuffer.byteLength,
      file_hash: fileHash,
      storage_path: storagePath,
      file_path: storagePath,
      source_file: "partner_application_registration",
      is_primary: true,
      is_active: true,
      match_status: "matched",
      review_status: "auto_matched"
    })
    .select("id")
    .single();

  if (error || !inserted) {
    await supabase.storage.from(PARTNER_DOCUMENTS_BUCKET).remove([storagePath]);
    throw new Error(error?.message ?? "신청서 문서 저장 실패");
  }

  return { document_id: String(inserted.id), reused: false };
}

export async function registerPartnerApplication(
  supabase: SupabaseClient,
  input: ApplicationRegisterInput
): Promise<ApplicationRegisterResult> {
  const warnings: string[] = [];
  try {
    if (!input.company.company_name_db.trim()) {
      return { ok: false, message: "DB 표시 회사명이 필요합니다." };
    }
    if (!input.contractStartDate) {
      return { ok: false, message: "계약일이 필요합니다." };
    }

    const foundedNormalized = normalizeApplicationDate(input.company.founded_date);
    if (input.company.founded_date?.trim() && !foundedNormalized.ok) {
      return { ok: false, message: FOUNDED_DATE_FORMAT_HINT };
    }

    const contractEnd = computeContractEndDate(input.contractStartDate);
    const matched =
      input.existingPartnerId
        ? {
            id: input.existingPartnerId,
            company_name: input.company.company_name_db,
            match: "company_name" as const
          }
        : await findMatchingPartner(supabase, input.company);

    let partnerId: string;
    let partnerCreated = false;
    let externalNo: string | null = null;

    const companyPayload: Record<string, unknown> = {
      company_name: input.company.company_name_db.trim(),
      contract_display_name: input.company.company_name_contract.trim() || null,
      business_number: formatBusinessNumberDisplay(input.company.business_number) || null,
      ceo_name: input.company.ceo_name?.trim() || null,
      website: input.company.website?.trim() || null,
      founded_date: foundedNormalized.iso,
      credit_rating: input.company.credit_rating?.trim() || null,
      address: input.company.address?.trim() || null,
      revenue_2023: input.company.revenue?.trim() || null,
      employee_count: input.company.employee_count?.trim() || null,
      engineer_count: input.company.engineer_count?.trim() || null,
      dedicated_sales_count: input.company.dedicated_sales_count?.trim() || null,
      dedicated_engineer_count: input.company.dedicated_engineer_count?.trim() || null,
      grade: input.grade,
      grade_original: input.grade,
      contract_start_date: input.contractStartDate,
      contract_end_date: contractEnd,
      status: "active",
      is_active: true,
      source_file: input.fileName,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (matched) {
      partnerId = matched.id;
      const updatePayload: Record<string, unknown> = {
        contract_start_date: input.contractStartDate,
        contract_end_date: contractEnd,
        grade: input.grade,
        contract_display_name: input.company.company_name_contract.trim() || null,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      };
      const allowed = new Set(input.updateFields ?? []);
      const fieldMap: Record<string, unknown> = {
        company_name: companyPayload.company_name,
        business_number: companyPayload.business_number,
        ceo_name: companyPayload.ceo_name,
        website: companyPayload.website,
        founded_date: companyPayload.founded_date,
        credit_rating: companyPayload.credit_rating,
        address: companyPayload.address,
        revenue_2023: companyPayload.revenue_2023,
        employee_count: companyPayload.employee_count,
        engineer_count: companyPayload.engineer_count
      };
      for (const [key, value] of Object.entries(fieldMap)) {
        if (allowed.has(key) && value != null && String(value).trim() !== "") {
          updatePayload[key] = value;
        }
      }
      const { data: existingPartner } = await supabase
        .from("partners")
        .select("external_no")
        .eq("id", partnerId)
        .maybeSingle();
      externalNo = existingPartner?.external_no ? String(existingPartner.external_no) : null;

      const { error } = await supabase.from("partners").update(updatePayload).eq("id", partnerId);
      if (error) {
        if (/invalid input syntax for type date/i.test(error.message)) {
          return { ok: false, message: FOUNDED_DATE_FORMAT_HINT };
        }
        throw new Error(error.message);
      }
      warnings.push(`기존 파트너와 매칭되었습니다 (${matched.match}).`);
    } else {
      externalNo = await allocateNextExternalNo(supabase);
      const { data, error } = await supabase
        .from("partners")
        .insert({ ...companyPayload, external_no: externalNo })
        .select("id, external_no")
        .single();
      if (error || !data) {
        if (error && /invalid input syntax for type date/i.test(error.message)) {
          return { ok: false, message: FOUNDED_DATE_FORMAT_HINT };
        }
        throw new Error(error?.message ?? "파트너 생성 실패");
      }
      partnerId = String(data.id);
      externalNo = data.external_no ? String(data.external_no) : externalNo;
      partnerCreated = true;
    }

    const merged = mergePeople(input.people);
    let created = 0;
    let updated = 0;
    for (const person of merged) {
      const action = await upsertContact(supabase, partnerId, person, input.fileName);
      if (action === "created") created += 1;
      else updated += 1;
    }

    const doc = await saveApplicationDocument(
      supabase,
      partnerId,
      input.fileName,
      input.fileBuffer,
      input.contentType ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return {
      ok: true,
      partner_id: partnerId,
      partner_created: partnerCreated,
      external_no: externalNo,
      contacts_created: created,
      contacts_updated: updated,
      document_id: doc.document_id,
      document_reused: doc.reused,
      warnings
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "파트너 신청서 등록 실패";
    if (/invalid input syntax for type date/i.test(raw)) {
      return { ok: false, message: FOUNDED_DATE_FORMAT_HINT };
    }
    console.error("[partner-application] register failed", raw);
    return {
      ok: false,
      message: "파트너 신청서 등록에 실패했습니다. 입력값을 확인한 뒤 다시 시도해 주세요."
    };
  }
}
