import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePartnerApplicationBuffer } from "@/lib/partner-application/parse-application";
import { findMatchingPartner } from "@/lib/partner-application/register";
import { normalizePersonName } from "@/lib/contacts/person-key";
import { normalizeBusinessNumber, normalizeCompanyName } from "@/lib/partner-match";
import { logApplicationEvent, PARTNER_APPLICATIONS_BUCKET } from "@/lib/partner-applications/repository";
import { EMPTY_APPLICATION_FORM, type PartnerApplicationFormPayload } from "@/lib/partner-applications/types";
import { collectMissingFields } from "@/lib/partner-applications/validation";
import { reviewApplicationTextWithOptionalLlm } from "@/lib/partner-applications/pre-review-ai";

export const AI_PRE_REVIEW_EVENT = "ai_pre_review";
export const AI_PRE_REVIEW_STARTED_EVENT = "ai_pre_review_started";

export type PreReviewSeverity = "ok" | "needs_fix" | "admin_check";
export type PreReviewRunStatus = "completed" | "failed" | "running";

export type PreReviewFinding = {
  id: string;
  label: string;
  severity: PreReviewSeverity;
  source: "rule" | "ai";
  detail?: string;
  sectionId?: string;
  comparison?: Array<{ label: string; value: string }>;
};

export type PreReviewResult = {
  status: PreReviewRunStatus;
  overall: PreReviewSeverity;
  findings: PreReviewFinding[];
  ai_used: boolean;
  ai_error: string | null;
  reviewed_at: string;
};

export type PreReviewDocument = {
  document_type?: string | null;
  file_name?: string | null;
  file_ext?: string | null;
  mime_type?: string | null;
  is_active?: boolean | null;
  storage_path?: string | null;
};

export type DuplicateHint = {
  id: string;
  company_name: string;
  match: string;
};

function filled(value: string | null | undefined): boolean {
  return Boolean(String(value ?? "").trim());
}

export function coerceApplicationForm(raw: unknown): PartnerApplicationFormPayload {
  const payload = (raw && typeof raw === "object" ? raw : {}) as Partial<PartnerApplicationFormPayload>;
  return {
    ...EMPTY_APPLICATION_FORM,
    ...payload,
    company: { ...EMPTY_APPLICATION_FORM.company, ...payload.company },
    contact: { ...EMPTY_APPLICATION_FORM.contact, ...payload.contact },
    flags: { ...EMPTY_APPLICATION_FORM.flags, ...payload.flags },
    people: {
      ceo: payload.people?.ceo?.length ? payload.people.ceo : EMPTY_APPLICATION_FORM.people.ceo,
      sales: payload.people?.sales?.length ? payload.people.sales : EMPTY_APPLICATION_FORM.people.sales,
      engineer: payload.people?.engineer ?? EMPTY_APPLICATION_FORM.people.engineer
    },
    customers: payload.customers?.length ? payload.customers : EMPTY_APPLICATION_FORM.customers,
    sales_strategy: payload.sales_strategy ?? "",
    equipment: payload.equipment ?? [],
    engineer_profiles: payload.engineer_profiles ?? [],
    applicant: { ...EMPTY_APPLICATION_FORM.applicant, ...payload.applicant }
  };
}

function overallFromFindings(findings: PreReviewFinding[], runStatus: PreReviewRunStatus): PreReviewSeverity {
  if (runStatus === "failed") return "admin_check";
  if (findings.some((f) => f.severity === "needs_fix")) return "needs_fix";
  if (findings.some((f) => f.severity === "admin_check")) return "admin_check";
  return "ok";
}

function pushOk(findings: PreReviewFinding[], id: string, label: string) {
  findings.push({ id, label, severity: "ok", source: "rule" });
}

function pushFix(findings: PreReviewFinding[], id: string, label: string, detail?: string) {
  findings.push({ id, label, severity: "needs_fix", source: "rule", detail });
}

function pushAdmin(
  findings: PreReviewFinding[],
  id: string,
  label: string,
  detail?: string,
  source: "rule" | "ai" = "rule",
  extra?: Pick<PreReviewFinding, "sectionId" | "comparison">
) {
  findings.push({ id, label, severity: "admin_check", source, detail, ...extra });
}

const HIDDEN_PRE_REVIEW_IDS = new Set(["flag.platinum", "flag.tech"]);

export function isLegacyGradeFlagFinding(finding: Pick<PreReviewFinding, "id" | "label" | "detail">): boolean {
  if (HIDDEN_PRE_REVIEW_IDS.has(finding.id)) return true;
  const text = `${finding.label} ${finding.detail ?? ""}`;
  return /플래티넘 검토|기술협력 요청|파트너 등급\s*\/\s*계약 조건/.test(text);
}

export function sanitizePreReviewForDisplay(review: PreReviewResult | null | undefined): PreReviewResult | null {
  if (!review) return null;
  const findings = (review.findings ?? []).filter((item) => !isLegacyGradeFlagFinding(item));
  return {
    ...review,
    findings,
    overall: overallFromFindings(findings, review.status)
  };
}

export function buildRuleBasedPreReview(input: {
  form: PartnerApplicationFormPayload;
  documents: PreReviewDocument[];
  duplicate?: DuplicateHint | null;
  parseMismatches?: Array<{ id: string; label: string; detail?: string }>;
}): PreReviewFinding[] {
  const findings: PreReviewFinding[] = [];
  const activeDocs = input.documents.filter((d) => d.is_active !== false);
  const hasBizDoc = activeDocs.some((d) => d.document_type === "business_registration");
  const missing = collectMissingFields(input.form, { hasBusinessRegistrationDoc: hasBizDoc });
  const missingByField = new Set(missing.map((m) => `${m.section}.${m.field}`));
  const hasMissing = (section: string, field: string) => missingByField.has(`${section}.${field}`);

  const companyMissing = missing.filter((m) =>
    ["company_name", "established_date", "address", "total_employees", "total_engineers", "dedicated_sales_count"].includes(
      m.field
    )
  );
  if (companyMissing.length) {
    for (const item of companyMissing) {
      pushFix(findings, `missing.${item.field}`, `회사 기본정보 누락: ${item.label}`);
    }
  } else {
    pushOk(findings, "company.basic", "회사 기본정보 확인");
  }

  if (hasMissing("company", "business_registration_number")) {
    pushFix(findings, "company.business_number", "사업자등록번호 누락 또는 형식이 올바르지 않습니다.");
  } else {
    pushOk(findings, "company.business_number", "사업자등록번호 확인");
  }

  if (hasMissing("company", "representative_name")) {
    pushFix(findings, "company.representative", "대표자 정보가 누락되었습니다.");
  } else {
    pushOk(findings, "company.representative", "대표자 정보 확인");
  }

  const contactMissing = missing.filter((m) => m.section === "contact");
  if (contactMissing.length) {
    for (const item of contactMissing) {
      pushFix(findings, `missing.${item.field}`, `담당자 정보 누락: ${item.label}`);
    }
  } else {
    pushOk(findings, "contact.basic", "담당자 정보 확인");
  }

  const formMissing = missing.filter(
    (m) =>
      m.section === "people" ||
      m.section === "customers" ||
      m.section === "equipment" ||
      m.section === "engineers"
  );
  if (formMissing.length) {
    for (const item of formMissing) {
      pushFix(findings, `missing.${item.section}.${item.field}`, `신청서 필수 항목 누락: ${item.label}`);
    }
  } else {
    pushOk(findings, "form.required", "파트너 신청서 필수 입력 항목 확인");
  }

  if (hasMissing("documents", "business_registration") || !hasBizDoc) {
    pushFix(findings, "docs.business_registration", "사업자등록증 미첨부");
  } else {
    pushOk(findings, "docs.business_registration", "사업자등록증 첨부 확인");
  }

  const ceoName = input.form.people.ceo.find((p) => filled(p.name))?.name ?? "";
  const representative = input.form.company.representative_name;
  if (filled(ceoName) && filled(representative)) {
    const a = normalizePersonName(ceoName);
    const b = normalizePersonName(representative);
    if (a && b && a !== b) {
      pushAdmin(
        findings,
        "mismatch.ceo",
        "대표자 정보 확인",
        "두 값이 달라 확인이 필요합니다.",
        "rule",
        {
          sectionId: "section-ceo",
          comparison: [
            { label: "기업정보 대표자명", value: representative },
            { label: "대표이사 입력 성명", value: ceoName }
          ]
        }
      );
    }
  }

  if (input.duplicate) {
    pushAdmin(
      findings,
      "duplicate.partner",
      "기존 파트너와 일치할 수 있습니다",
      `${input.duplicate.company_name}과(와) 같은 업체로 보입니다.`,
      "rule",
      { sectionId: "section-company" }
    );
  }

  for (const mismatch of input.parseMismatches ?? []) {
    pushFix(findings, mismatch.id, mismatch.label, mismatch.detail);
  }

  return findings;
}

export function compareParsedApplication(
  form: PartnerApplicationFormPayload,
  parsed: {
    company: {
      company_name_db?: string | null;
      company_name_raw?: string | null;
      business_number?: string | null;
      ceo_name?: string | null;
    };
  }
): Array<{ id: string; label: string; detail?: string }> {
  const mismatches: Array<{ id: string; label: string; detail?: string }> = [];
  const parsedBn = normalizeBusinessNumber(parsed.company.business_number);
  const formBn = normalizeBusinessNumber(form.company.business_registration_number);
  if (parsedBn && formBn && parsedBn !== formBn) {
    mismatches.push({
      id: "parse.business_number",
      label: "파싱된 신청서와 입력 사업자등록번호가 다릅니다",
      detail: `신청서: ${parsed.company.business_number} / 입력: ${form.company.business_registration_number}`
    });
  }

  const parsedName =
    normalizeCompanyName(parsed.company.company_name_db) ||
    normalizeCompanyName(parsed.company.company_name_raw);
  const formName = normalizeCompanyName(form.company.company_name);
  if (parsedName && formName && parsedName !== formName) {
    mismatches.push({
      id: "parse.company_name",
      label: "파싱된 신청서와 입력 기업명이 명백히 다릅니다",
      detail: `신청서: ${parsed.company.company_name_raw || parsed.company.company_name_db} / 입력: ${form.company.company_name}`
    });
  }

  const parsedCeo = normalizePersonName(parsed.company.ceo_name);
  const formCeo = normalizePersonName(form.company.representative_name);
  if (parsedCeo && formCeo && parsedCeo !== formCeo) {
    mismatches.push({
      id: "parse.ceo",
      label: "파싱된 신청서와 입력 대표자명이 다릅니다",
      detail: `신청서: ${parsed.company.ceo_name} / 입력: ${form.company.representative_name}`
    });
  }

  return mismatches;
}

export function latestPreReviewFromEvents(
  events: Array<{ event_type?: unknown; payload?: unknown; created_at?: unknown }>
): PreReviewResult | null {
  const sorted = [...events].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
  );
  const row = sorted.find((ev) => String(ev.event_type) === AI_PRE_REVIEW_EVENT);
  if (row && row.payload && typeof row.payload === "object") {
    return sanitizePreReviewForDisplay(row.payload as PreReviewResult);
  }
  const started = sorted.find((ev) => String(ev.event_type) === AI_PRE_REVIEW_STARTED_EVENT);
  if (started) {
    return {
      status: "running",
      overall: "admin_check",
      findings: [],
      ai_used: false,
      ai_error: null,
      reviewed_at: String(started.created_at ?? "")
    };
  }
  return null;
}

function isSpreadsheetDoc(doc: PreReviewDocument): boolean {
  const name = String(doc.file_name ?? "").toLowerCase();
  const ext = String(doc.file_ext ?? "").toLowerCase();
  const mime = String(doc.mime_type ?? "").toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    ext === "xlsx" ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  );
}

async function parseAttachedSpreadsheets(
  supabase: SupabaseClient,
  form: PartnerApplicationFormPayload,
  documents: PreReviewDocument[]
): Promise<Array<{ id: string; label: string; detail?: string }>> {
  const mismatches: Array<{ id: string; label: string; detail?: string }> = [];
  const sheets = documents.filter((d) => d.is_active !== false && d.storage_path && isSpreadsheetDoc(d));
  for (const doc of sheets.slice(0, 2)) {
    try {
      const { data, error } = await supabase.storage
        .from(PARTNER_APPLICATIONS_BUCKET)
        .download(String(doc.storage_path));
      if (error || !data) continue;
      const buffer = Buffer.from(await data.arrayBuffer());
      const parsed = parsePartnerApplicationBuffer(buffer);
      if (!parsed.ok) continue;
      mismatches.push(...compareParsedApplication(form, parsed));
    } catch {
      // 파싱 실패는 오류로 단정하지 않음
    }
  }
  return mismatches;
}

export async function runApplicationPreReview(
  supabase: SupabaseClient,
  applicationId: string,
  actorUserId?: string | null
): Promise<PreReviewResult> {
  const reviewedAt = new Date().toISOString();
  try {
    await logApplicationEvent(
      supabase,
      applicationId,
      AI_PRE_REVIEW_STARTED_EVENT,
      "AI Agent 사전검토 시작",
      {},
      actorUserId
    );

    const [{ data: app, error: appError }, { data: documents }] = await Promise.all([
      supabase.from("partner_applications").select("*").eq("id", applicationId).maybeSingle(),
      supabase
        .from("partner_application_documents")
        .select("document_type, file_name, file_ext, mime_type, is_active, storage_path")
        .eq("application_id", applicationId)
    ]);
    if (appError || !app) {
      throw new Error(appError?.message || "신청서를 찾을 수 없습니다.");
    }

    const form = coerceApplicationForm(app.form_payload);
    const docs = (documents ?? []) as PreReviewDocument[];

    let duplicate: DuplicateHint | null = null;
    try {
      duplicate = await findMatchingPartner(supabase, {
        company_name_db: form.company?.company_name ?? "",
        company_name_contract: form.company?.company_name ?? "",
        business_number: form.company?.business_registration_number || null,
        ceo_name: form.company?.representative_name || null,
        website: form.company?.website || null,
        founded_date: form.company?.established_date || null,
        credit_rating: form.company?.credit_grade || null,
        address: form.company?.address || null,
        revenue: form.company?.revenue || null,
        employee_count: form.company?.total_employees || null,
        engineer_count: form.company?.total_engineers || null,
        dedicated_sales_count: form.company?.dedicated_sales_count || null,
        dedicated_engineer_count: form.company?.dedicated_technical_count || null
      });
    } catch {
      duplicate = null;
    }

    const parseMismatches = await parseAttachedSpreadsheets(supabase, form, docs);

    const findings = buildRuleBasedPreReview({
      form,
      documents: docs,
      duplicate,
      parseMismatches
    });

    const ai = await reviewApplicationTextWithOptionalLlm({
      company_name: form.company?.company_name,
      sales_strategy: form.sales_strategy,
      customers: (form.customers ?? []).map((c) => ({
        customer_name: c.customer_name,
        proposal_status: c.proposal_status,
        note: c.note
      }))
    });

    if (ai.used && ai.findings.length) {
      findings.push(...ai.findings);
    }

    const status: PreReviewRunStatus = ai.error ? "failed" : "completed";
    if (ai.error) {
      pushAdmin(
        findings,
        "ai.failed",
        "AI 검토를 완료하지 못했습니다. 관리자 직접 검토가 필요합니다.",
        ai.error,
        "ai"
      );
    }

    const result: PreReviewResult = sanitizePreReviewForDisplay({
      status,
      overall: overallFromFindings(findings, status),
      findings,
      ai_used: ai.used,
      ai_error: ai.error,
      reviewed_at: reviewedAt
    })!;

    await logApplicationEvent(
      supabase,
      applicationId,
      AI_PRE_REVIEW_EVENT,
      status === "failed"
        ? "AI Agent 사전검토 실패 — 관리자 직접 검토"
        : "AI Agent 사전검토 완료",
      result as unknown as Record<string, unknown>,
      actorUserId
    );

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "사전검토 실패";
    const result: PreReviewResult = {
      status: "failed",
      overall: "admin_check",
      findings: [
        {
          id: "ai.failed",
          label: "AI 검토를 완료하지 못했습니다. 관리자 직접 검토가 필요합니다.",
          severity: "admin_check",
          source: "ai",
          detail: message
        }
      ],
      ai_used: false,
      ai_error: message,
      reviewed_at: reviewedAt
    };
    try {
      await logApplicationEvent(
        supabase,
        applicationId,
        AI_PRE_REVIEW_EVENT,
        "AI Agent 사전검토 실패 — 관리자 직접 검토",
        result as unknown as Record<string, unknown>,
        actorUserId
      );
    } catch {
      // 이벤트 기록 실패해도 신청 자체는 유지
    }
    return result;
  }
}
