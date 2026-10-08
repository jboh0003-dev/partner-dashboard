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
  normalizePartnerDisplayCompanyName,
  type PartnerContractGrade
} from "@/lib/partner-application/contract-dates";
import {
  FOUNDED_DATE_FORMAT_HINT,
  normalizeApplicationDate
} from "@/lib/partner-application/normalize-application-date";
import { inferPartnerAddressLocation } from "@/lib/partners/address-location";

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
  requestedExternalNo?: string | null;
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

async function ensureExternalNoAvailable(
  supabase: SupabaseClient,
  externalNo: string,
  excludePartnerId?: string | null
): Promise<void> {
  let query = supabase
    .from("partners")
    .select("id, company_name")
    .eq("external_no", externalNo)
    .is("deleted_at", null)
    .limit(1);

  if (excludePartnerId) query = query.neq("id", excludePartnerId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (data) {
    throw new Error(`${externalNo}번은 이미 ${String(data.company_name)}에서 사용 중입니다.`);
  }
}

function normalizeKoreanPersonName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[가-힣\s]{2,12}$/u.test(trimmed)) return trimmed.replace(/\s+/g, "");
  return trimmed.replace(/\s{2,}/g, " ");
}

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
    const name = normalizeKoreanPersonName(person.name) ?? "";
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

  // 같은 파일명으로 수정본을 다시 올리는 경우 기존 활성 문서를 비활성화해
  // active unique index 충돌 없이 최신 신청서를 저장한다.
  const { data: sameName } = await supabase
    .from("partner_documents")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("document_type", "partner_application")
    .eq("original_filename", fileName)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (sameName?.id) {
    const { error: deactivateError } = await supabase
      .from("partner_documents")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", sameName.id);
    if (deactivateError) throw new Error(deactivateError.message);
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
      file_name: "파트너 신청서",
      display_name: "파트너 신청서",
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
    const addressLocation = inferPartnerAddressLocation(input.company.address);
    const requestedExternalNo = input.requestedExternalNo?.trim() || null;
    if (requestedExternalNo && !/^\d+$/.test(requestedExternalNo)) {
      return { ok: false, message: "파트너 번호(일련번호)는 숫자로 입력해 주세요." };
    }
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
      company_name: normalizePartnerDisplayCompanyName(input.company.company_name_db),
      contract_display_name: input.company.company_name_contract.trim() || null,
      business_number: formatBusinessNumberDisplay(input.company.business_number) || null,
      ceo_name: normalizeKoreanPersonName(input.company.ceo_name),
      website: input.company.website?.trim() || null,
      founded_date: foundedNormalized.iso,
      credit_rating: input.company.credit_rating?.trim() || "-",
      address: input.company.address?.trim() || null,
      region_group: addressLocation.regionGroup || null,
      region: addressLocation.region || null,
      city: addressLocation.city || null,
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
      if (allowed.has("address") && companyPayload.address) {
        if (addressLocation.regionGroup) updatePayload.region_group = addressLocation.regionGroup;
        if (addressLocation.region) updatePayload.region = addressLocation.region;
        if (addressLocation.city) updatePayload.city = addressLocation.city;
      }
      const { data: existingPartner } = await supabase
        .from("partners")
        .select("external_no")
        .eq("id", partnerId)
        .maybeSingle();
      externalNo = requestedExternalNo
        ?? (existingPartner?.external_no ? String(existingPartner.external_no) : null);

      if (externalNo) {
        await ensureExternalNoAvailable(supabase, externalNo, partnerId);
        updatePayload.external_no = externalNo;
      }

      const { error } = await supabase.from("partners").update(updatePayload).eq("id", partnerId);
      if (error) {
        if (/invalid input syntax for type date/i.test(error.message)) {
          return { ok: false, message: FOUNDED_DATE_FORMAT_HINT };
        }
        throw new Error(error.message);
      }
      warnings.push(`기존 파트너와 매칭되었습니다 (${matched.match}).`);
    } else {
      externalNo = requestedExternalNo ?? await allocateNextExternalNo(supabase);
      await ensureExternalNoAvailable(supabase, externalNo);
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
    const [contactActions, doc] = await Promise.all([
      Promise.all(
        merged.map((person) =>
          upsertContact(supabase, partnerId, person, input.fileName)
        )
      ),
      saveApplicationDocument(
        supabase,
        partnerId,
        input.fileName,
        input.fileBuffer,
        input.contentType ??
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    ]);

    const created = contactActions.filter((action) => action === "created").length;
    const updated = contactActions.filter((action) => action === "updated").length;

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

    if (/번은 이미 .+에서 사용 중입니다\.?$/i.test(raw)) {
      console.error("[partner-application] register failed", raw);
      return {
        ok: false,
        message: `파트너 번호 중복: ${raw} 다른 번호를 입력하거나 기존 파트너 번호를 확인해 주세요.`
      };
    }

    if (/duplicate key value violates unique constraint.*business_number/i.test(raw)) {
      const normalizedBusinessNumber = normalizeBusinessNumber(input.company.business_number);
      let duplicateLabel = "";

      if (normalizedBusinessNumber) {
        const { data: rows } = await supabase
          .from("partners")
          .select("external_no, company_name, business_number")
          .is("deleted_at", null)
          .limit(5000);

        const duplicate = (rows ?? []).find(
          (row) => normalizeBusinessNumber(row.business_number as string | null) === normalizedBusinessNumber
        );

        if (duplicate) {
          duplicateLabel = duplicate.external_no
            ? `파트너 ${String(duplicate.external_no)}번 ${String(duplicate.company_name)}`
            : String(duplicate.company_name);
        }
      }

      console.error("[partner-application] register failed", raw);
      return {
        ok: false,
        message: duplicateLabel
          ? `사업자등록번호 중복: ${formatBusinessNumberDisplay(input.company.business_number)}는 이미 ${duplicateLabel}에 등록되어 있습니다. 기존 파트너를 선택해 업데이트하거나 사업자등록번호를 확인해 주세요.`
          : `사업자등록번호 중복: ${formatBusinessNumberDisplay(input.company.business_number)}가 이미 다른 활성 파트너에 등록되어 있습니다. 기존 파트너 매칭 여부를 확인해 주세요.`
      };
    }

    console.error("[partner-application] register failed", raw);
    return {
      ok: false,
      message: `등록 처리 중 오류가 발생했습니다. 원인: ${raw}`
    };
  }
}
