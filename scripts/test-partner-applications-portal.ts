/**
 * Smoke tests for partner application portal helpers (no DB).
 */
import assert from "node:assert/strict";
import { collectMissingFields } from "../src/lib/partner-applications/validation";
import { EMPTY_APPLICATION_FORM } from "../src/lib/partner-applications/types";
import { fillPartnerApplicationExcel } from "../src/lib/partner-applications/excel-fill";
import { generateApplicationNumber, hashSecret, verifySecret } from "../src/lib/partner-applications/tokens";

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
  const techMissing = collectMissingFields(form, { hasBusinessRegistrationDoc: true });
  assert.ok(techMissing.some((m) => m.field === "engineer"));
  assert.ok(techMissing.some((m) => m.section === "equipment"));
  assert.ok(techMissing.some((m) => m.section === "engineers"));

  const token = "abc123token";
  const hash = hashSecret(token);
  assert.equal(verifySecret(token, hash), true);
  assert.equal(verifySecret("wrong", hash), false);
  assert.match(generateApplicationNumber(), /^PA-\d{4}-[0-9A-F]+$/i);

  const buf = await fillPartnerApplicationExcel(form);
  assert.ok(buf.byteLength > 1000, "excel buffer should be non-trivial");

  console.log("partner-applications smoke tests OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
