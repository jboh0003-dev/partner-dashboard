/**
 * Smoke tests for partner application portal helpers (no DB).
 */
import assert from "node:assert/strict";
import { collectMissingFields } from "../src/lib/partner-applications/validation";
import { EMPTY_APPLICATION_FORM } from "../src/lib/partner-applications/types";
import { fillPartnerApplicationExcel } from "../src/lib/partner-applications/excel-fill";
import { generateApplicationNumber, hashSecret, verifySecret } from "../src/lib/partner-applications/tokens";
import {
  buildRuleBasedPreReview,
  compareParsedApplication,
  sanitizePreReviewForDisplay
} from "../src/lib/partner-applications/pre-review";
import { resolveApplicationDisplayStatus } from "../src/lib/partner-applications/status-display";
import { buildApplicationDocumentStorageKey } from "../src/lib/partner-applications/storage-key";
import { recommendedDocumentFileName } from "../src/lib/partner-applications/filename-guide";
import { isAutosaveEvent, isBusinessHistoryEvent } from "../src/lib/partner-applications/admin-display";

async function main() {
  const missingEmpty = collectMissingFields(EMPTY_APPLICATION_FORM, {
    hasBusinessRegistrationDoc: false
  });
  assert.ok(missingEmpty.length > 5, "empty form should miss many required fields");

  const form = structuredClone(EMPTY_APPLICATION_FORM);
  form.company = {
    company_name: "테스트파트너",
    business_registration_number: "123-45-67890",
    representative_name: "홍길동",
    established_date: "2020-01-01",
    address: "서울",
    website: "",
    credit_grade: "",
    revenue: "",
    total_employees: "10",
    total_engineers: "3",
    dedicated_sales_count: "1",
    dedicated_technical_count: "1"
  };
  form.contact = {
    name: "김담당",
    position: "과장",
    department: "영업",
    phone: "010-1234-5678",
    email: "a@test.com",
    office_phone: ""
  };
  form.people.ceo = [{ section: "ceo", name: "홍길동" }];
  form.people.sales = [{ section: "sales", name: "김영업", duty: "영업" }];
  form.customers = [
    {
      customer_name: "고객A",
      proposal_status: "제안중",
      business_timing: "2026 H2",
      revenue_target: "1억"
    }
  ];

  const stillMissingDoc = collectMissingFields(form, { hasBusinessRegistrationDoc: false });
  assert.equal(
    stillMissingDoc.some((m) => m.field === "business_registration"),
    true
  );
  const ok = collectMissingFields(form, { hasBusinessRegistrationDoc: true });
  assert.equal(ok.length, 0, `unexpected missing: ${JSON.stringify(ok)}`);

  form.flags.technical_collaboration_requested = true;
  form.flags.platinum_review_requested = true;
  const techNotRequired = collectMissingFields(form, { hasBusinessRegistrationDoc: true });
  assert.equal(techNotRequired.some((m) => m.field === "engineer"), false);
  assert.equal(techNotRequired.some((m) => m.section === "equipment"), false);
  assert.equal(techNotRequired.some((m) => m.section === "engineers"), false);

  const optionalCustomer = structuredClone(form);
  optionalCustomer.customers = [{ customer_name: "고객A" }];
  optionalCustomer.people.engineer = [];
  optionalCustomer.equipment = [];
  optionalCustomer.engineer_profiles = [];
  optionalCustomer.company.dedicated_technical_count = "";
  const optionalOk = collectMissingFields(optionalCustomer, { hasBusinessRegistrationDoc: true });
  assert.equal(optionalOk.length, 0, `optional fields should not block: ${JSON.stringify(optionalOk)}`);

  const token = "abc123token";
  const hash = hashSecret(token);
  assert.equal(verifySecret(token, hash), true);
  assert.equal(verifySecret("wrong", hash), false);
  assert.match(generateApplicationNumber(), /^PA-\d{4}-[0-9A-F]+$/i);

  form.flags.technical_collaboration_requested = false;
  form.flags.platinum_review_requested = false;

  const buf = await fillPartnerApplicationExcel(form);
  assert.ok(buf.byteLength > 1000, "excel buffer should be non-trivial");

  const completeFindings = buildRuleBasedPreReview({
    form,
    documents: [{ document_type: "business_registration", is_active: true, file_name: "biz.pdf" }]
  });
  assert.equal(
    completeFindings.some((f) => f.severity === "needs_fix"),
    false,
    `A. complete application should have no needs_fix: ${JSON.stringify(completeFindings.filter((f) => f.severity !== "ok"))}`
  );
  assert.equal(
    resolveApplicationDisplayStatus({
      dbStatus: "submitted",
      preReview: { status: "completed", overall: "ok" }
    }),
    "admin_review"
  );

  const missingFindings = buildRuleBasedPreReview({
    form: EMPTY_APPLICATION_FORM,
    documents: []
  });
  assert.ok(missingFindings.some((f) => f.id === "docs.business_registration"));
  assert.ok(missingFindings.some((f) => f.severity === "needs_fix"));
  assert.equal(
    resolveApplicationDisplayStatus({
      dbStatus: "submitted",
      preReview: { status: "completed", overall: "needs_fix" }
    }),
    "needs_revision"
  );

  assert.equal(
    resolveApplicationDisplayStatus({
      dbStatus: "submitted",
      preReview: { status: "failed", overall: "admin_check" }
    }),
    "admin_review",
    "C. AI failure still allows admin review"
  );
  assert.equal(
    resolveApplicationDisplayStatus({ dbStatus: "approved", preReview: null }),
    "approved"
  );
  assert.equal(
    resolveApplicationDisplayStatus({ dbStatus: "rejected", preReview: null }),
    "rejected"
  );

  const mismatches = compareParsedApplication(form, {
    company: {
      company_name_db: "다른회사",
      company_name_raw: "다른회사",
      business_number: "999-99-99999",
      ceo_name: "다른대표"
    }
  });
  assert.ok(mismatches.some((m) => m.id === "parse.business_number"));
  assert.ok(mismatches.some((m) => m.id === "parse.company_name"));

  const noGuess = compareParsedApplication(form, {
    company: { company_name_db: null, business_number: null, ceo_name: null }
  });
  assert.equal(noGuess.length, 0, "missing parsed fields must not be treated as mismatch");

  const key = buildApplicationDocumentStorageKey("app-id", "other", "★260810_파트너대시보드_업로드용.xlsx");
  assert.match(key, /^app-id\/other\/[0-9a-f-]+\.xlsx$/i);
  assert.equal(key.includes("★"), false);
  assert.equal(key.includes("파트너"), false);

  const flagged = structuredClone(form);
  flagged.flags.platinum_review_requested = true;
  flagged.flags.technical_collaboration_requested = true;
  const flaggedFindings = buildRuleBasedPreReview({
    form: flagged,
    documents: [{ document_type: "business_registration", is_active: true, file_name: "biz.pdf" }]
  });
  assert.equal(flaggedFindings.some((f) => f.id === "flag.platinum" || f.id === "flag.tech"), false);
  assert.equal(
    flaggedFindings.some((f) => /플래티넘|기술협력|등급\/계약/.test(`${f.label}${f.detail ?? ""}`)),
    false
  );

  const mismatchForm = structuredClone(form);
  mismatchForm.company.representative_name = "복";
  mismatchForm.people.ceo = [{ section: "ceo", name: "1" }];
  const mismatchFindings = buildRuleBasedPreReview({
    form: mismatchForm,
    documents: [{ document_type: "business_registration", is_active: true, file_name: "biz.pdf" }]
  });
  const ceoFinding = mismatchFindings.find((f) => f.id === "mismatch.ceo");
  assert.ok(ceoFinding);
  assert.equal(ceoFinding?.comparison?.some((c) => c.label.includes("대표자명") && c.value === "복"), true);
  assert.equal(ceoFinding?.comparison?.some((c) => c.label.includes("대표이사") && c.value === "1"), true);

  const sanitized = sanitizePreReviewForDisplay({
    status: "completed",
    overall: "admin_check",
    findings: [
      {
        id: "flag.platinum",
        label: "파트너 등급/계약 조건 확인 필요",
        severity: "admin_check",
        source: "rule",
        detail: "플래티넘 검토가 요청되었습니다."
      }
    ],
    ai_used: false,
    ai_error: null,
    reviewed_at: new Date().toISOString()
  });
  assert.equal(sanitized?.findings.length, 0);
  assert.equal(sanitized?.overall, "ok");

  assert.equal(recommendedDocumentFileName("business_registration", "오케스트로"), "사업자등록증_오케스트로.pdf");
  assert.equal(isAutosaveEvent("draft_saved"), true);
  assert.equal(isBusinessHistoryEvent("draft_saved"), false);
  assert.equal(isBusinessHistoryEvent("submitted"), true);

  console.log("partner-applications smoke tests OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
