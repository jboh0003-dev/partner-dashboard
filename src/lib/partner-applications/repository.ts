import type { SupabaseClient } from "@supabase/supabase-js";
import type { PartnerApplicationFormPayload } from "@/lib/partner-applications/types";
import {
  businessNumberNormalized,
  collectMissingFields,
  normalizeFormForStorage
} from "@/lib/partner-applications/validation";

export const PARTNER_APPLICATIONS_BUCKET = "partner-applications";

export async function replaceChildRows(
  supabase: SupabaseClient,
  applicationId: string,
  form: PartnerApplicationFormPayload
) {
  await supabase.from("partner_application_people").delete().eq("application_id", applicationId);
  await supabase.from("partner_application_customers").delete().eq("application_id", applicationId);
  await supabase.from("partner_application_equipment").delete().eq("application_id", applicationId);
  await supabase.from("partner_application_engineers").delete().eq("application_id", applicationId);

  const people = [
    ...form.people.ceo.map((p, i) => ({ ...p, section: "ceo" as const, sort_order: i })),
    ...form.people.sales.map((p, i) => ({ ...p, section: "sales" as const, sort_order: i })),
    ...form.people.engineer.map((p, i) => ({
      ...p,
      section: "engineer" as const,
      sort_order: i
    }))
  ]
    .filter((p) => String(p.name ?? "").trim())
    .map((p) => ({
      application_id: applicationId,
      section: p.section,
      sort_order: p.sort_order ?? 0,
      duty: p.duty ?? null,
      department: p.department ?? null,
      name: p.name ?? null,
      position: p.position ?? null,
      phone: p.phone ?? null,
      email: p.email ?? null,
      note: p.note ?? null,
      skill_level: p.skill_level ?? null,
      main_skills: p.main_skills ?? null
    }));

  if (people.length) {
    const { error } = await supabase.from("partner_application_people").insert(people);
    if (error) throw new Error(error.message);
  }

  const customers = form.customers
    .filter((c) => String(c.customer_name ?? "").trim())
    .map((c, i) => ({
      application_id: applicationId,
      sort_order: i,
      customer_name: c.customer_name ?? null,
      proposal_status: c.proposal_status ?? null,
      business_timing: c.business_timing ?? null,
      revenue_target: c.revenue_target ?? null,
      note: c.note ?? null
    }));
  if (customers.length) {
    const { error } = await supabase.from("partner_application_customers").insert(customers);
    if (error) throw new Error(error.message);
  }

  const equipment = form.equipment
    .filter((e) => String(e.equipment_name ?? "").trim())
    .map((e, i) => ({
      application_id: applicationId,
      sort_order: i,
      equipment_name: e.equipment_name ?? null,
      model: e.model ?? null,
      quantity: e.quantity ?? null,
      note: e.note ?? null
    }));
  if (equipment.length) {
    const { error } = await supabase.from("partner_application_equipment").insert(equipment);
    if (error) throw new Error(error.message);
  }

  const engineers = form.engineer_profiles
    .filter((e) => String(e.name ?? "").trim())
    .map((e, i) => ({
      application_id: applicationId,
      profile_sheet: e.profile_sheet === 2 ? 2 : 1,
      sort_order: i,
      name: e.name ?? null,
      career_years: e.career_years ?? null,
      main_skills: e.main_skills ?? null,
      certifications: e.certifications ?? null,
      note: e.note ?? null
    }));
  if (engineers.length) {
    const { error } = await supabase.from("partner_application_engineers").insert(engineers);
    if (error) throw new Error(error.message);
  }
}

export function formToApplicationColumns(form: PartnerApplicationFormPayload) {
  const normalized = normalizeFormForStorage(form);
  const bn = businessNumberNormalized(normalized.company.business_registration_number);
  return {
    company_name: normalized.company.company_name || null,
    business_registration_number:
      normalized.company.business_registration_number || null,
    business_number_normalized: bn || null,
    representative_name: normalized.company.representative_name || null,
    established_date_display: normalized.company.established_date || null,
    address: normalized.company.address || null,
    website: normalized.company.website || null,
    credit_grade: normalized.company.credit_grade || null,
    revenue: normalized.company.revenue || null,
    total_employees: parseIntOrNull(normalized.company.total_employees),
    total_engineers: parseIntOrNull(normalized.company.total_engineers),
    dedicated_sales_count: parseIntOrNull(normalized.company.dedicated_sales_count),
    dedicated_technical_count: parseIntOrNull(normalized.company.dedicated_technical_count),
    contact_name: normalized.contact.name || null,
    contact_position: normalized.contact.position || null,
    contact_department: normalized.contact.department || null,
    contact_phone: normalized.contact.phone || null,
    contact_email: normalized.contact.email || null,
    contact_office_phone: normalized.contact.office_phone || null,
    technical_collaboration_requested: normalized.flags.technical_collaboration_requested,
    platinum_review_requested: normalized.flags.platinum_review_requested,
    sales_strategy: normalized.sales_strategy || null,
    applicant_name: normalized.applicant.name || normalized.contact.name || null,
    applicant_email: normalized.applicant.email || normalized.contact.email || null,
    form_payload: normalized
  };
}

function parseIntOrNull(value: string): number | null {
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function countActiveBusinessRegistrationDoc(
  supabase: SupabaseClient,
  applicationId: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("partner_application_documents")
    .select("id", { count: "exact", head: true })
    .eq("application_id", applicationId)
    .eq("document_type", "business_registration")
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function saveApplicationForm(
  supabase: SupabaseClient,
  applicationId: string,
  form: PartnerApplicationFormPayload
) {
  const hasDoc = await countActiveBusinessRegistrationDoc(supabase, applicationId);
  const missing = collectMissingFields(form, { hasBusinessRegistrationDoc: hasDoc });
  const columns = formToApplicationColumns(form);

  const { error } = await supabase
    .from("partner_applications")
    .update({
      ...columns,
      missing_required_count: missing.length,
      updated_at: new Date().toISOString()
    })
    .eq("id", applicationId);
  if (error) throw new Error(error.message);

  await replaceChildRows(supabase, applicationId, normalizeFormForStorage(form));
  return { missing };
}

export async function logApplicationEvent(
  supabase: SupabaseClient,
  applicationId: string,
  eventType: string,
  message?: string,
  payload?: Record<string, unknown>,
  actorUserId?: string | null
) {
  await supabase.from("partner_application_events").insert({
    application_id: applicationId,
    event_type: eventType,
    message: message ?? null,
    payload: payload ?? {},
    actor_user_id: actorUserId ?? null
  });
}

export async function deletePartnerApplication(
  supabase: SupabaseClient,
  applicationId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: app, error: fetchError } = await supabase
    .from("partner_applications")
    .select("id, approved_partner_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (fetchError) return { ok: false, message: fetchError.message };
  if (!app) return { ok: false, message: "신청서를 찾을 수 없습니다." };

  const { data: documents } = await supabase
    .from("partner_application_documents")
    .select("storage_path")
    .eq("application_id", applicationId);

  const storagePaths = [...new Set((documents ?? []).map((row) => String(row.storage_path ?? "").trim()).filter(Boolean))];
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(PARTNER_APPLICATIONS_BUCKET)
      .remove(storagePaths);
    if (storageError) {
      return { ok: false, message: "첨부파일 정리에 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }
  }

  const { error: deleteError } = await supabase
    .from("partner_applications")
    .delete()
    .eq("id", applicationId);

  if (deleteError) return { ok: false, message: deleteError.message };
  return { ok: true };
}
