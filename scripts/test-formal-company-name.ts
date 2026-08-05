import assert from "assert";
import {
  combineFormalCompanyName,
  extractFormalCompanyNameFromContractFilename,
  resolveFormalCompanyNameFromSources
} from "../src/lib/platinum-upgrade/formal-company-name";

function run() {
  assert.strictEqual(
    extractFormalCompanyNameFromContractFilename(
      "실버_OKESTRO_표준 파트너계약서_(주)휴버텍_250623.pdf"
    ),
    "(주)휴버텍"
  );
  assert.strictEqual(
    extractFormalCompanyNameFromContractFilename(
      "실버_OKESTRO_표준 파트너계약서_주식회사 아이윌아이엔씨_250623.pdf"
    ),
    "주식회사 아이윌아이엔씨"
  );
  assert.strictEqual(
    extractFormalCompanyNameFromContractFilename(
      "실버_OKESTRO_표준 파트너계약서_케이디디아이코리아(주)_250623.pdf"
    ),
    "케이디디아이코리아(주)"
  );
  assert.strictEqual(
    extractFormalCompanyNameFromContractFilename("(250930) 128_파트너 계약서_소클(실버).pdf"),
    "소클"
  );

  // DB 철자 유지 + 계약서 법인 표기만 적용 (엔티에스 → 앤티에스)
  const ants = combineFormalCompanyName("앤티에스", ["주식회사 엔티에스"]);
  assert.strictEqual(ants.name, "주식회사 앤티에스");
  assert.strictEqual(ants.style, "prefix_jusik");

  const antsResolved = resolveFormalCompanyNameFromSources({
    partner: { company_name: "앤티에스", contract_display_name: null },
    documents: [
      {
        document_type: "partner_contract",
        extracted_partner_name: "엔티에스",
        partner_name_raw: "엔티에스",
        original_filename: "실버_OKESTRO_표준 파트너계약서_주식회사 엔티에스_250623.pdf"
      }
    ]
  });
  assert.strictEqual(antsResolved.name, "주식회사 앤티에스");
  assert.strictEqual(antsResolved.source, "partner_contract");
  assert.strictEqual(antsResolved.display_name, "앤티에스");

  const fromContractFilename = resolveFormalCompanyNameFromSources({
    partner: { company_name: "휴버텍", contract_display_name: null },
    documents: [
      {
        document_type: "partner_contract",
        extracted_partner_name: "휴버텍",
        partner_name_raw: "휴버텍",
        original_filename: "실버_OKESTRO_표준 파트너계약서_(주)휴버텍_250623.pdf"
      },
      {
        document_type: "business_registration",
        extracted_partner_name: "주식회사 휴버텍",
        partner_name_raw: null
      }
    ]
  });
  assert.strictEqual(fromContractFilename.name, "(주)휴버텍");
  assert.strictEqual(fromContractFilename.source, "partner_contract");

  const socklViaApplication = resolveFormalCompanyNameFromSources({
    partner: { company_name: "소클", contract_display_name: null },
    applicationContractName: "㈜ 소클",
    documents: [
      {
        document_type: "partner_contract",
        extracted_partner_name: "소클",
        partner_name_raw: "소클",
        original_filename: "(250930) 128_파트너 계약서_소클(실버).pdf"
      },
      {
        document_type: "business_registration",
        extracted_partner_name: "[완료] 소클",
        partner_name_raw: "소클"
      }
    ]
  });
  assert.strictEqual(socklViaApplication.name, "㈜소클");
  assert.strictEqual(socklViaApplication.source, "partner_application_contract");

  const fromDisplay = resolveFormalCompanyNameFromSources({
    partner: { company_name: "소클", contract_display_name: "소클(주)" },
    documents: []
  });
  assert.strictEqual(fromDisplay.name, "소클(주)");
  assert.strictEqual(fromDisplay.source, "contract_display_name");

  console.log("formal-company-name tests ok");
}

run();
