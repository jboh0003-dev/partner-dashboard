/**
 * 파트너 신청서 / 계약서 생성 스모크 테스트
 * 실행: npx tsx scripts/test-partner-application.ts
 */
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { parsePhoneFromCell, normalizePhoneInput } from "../src/lib/contacts/phone-normalize";
import { normalizeApplicationDate } from "../src/lib/partner-application/normalize-application-date";
import {
  computeContractEndDate,
  formatBusinessNumberDisplay,
  formatContractKoreanDate,
  normalizeContractCompanyName
} from "../src/lib/partner-application/contract-dates";
import {
  extractPlainText,
  generatePartnerContractDocx
} from "../src/lib/partner-application/generate-contract";
import { parsePartnerApplicationBuffer } from "../src/lib/partner-application/parse-application";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function runHasBoldUnderline(runXml: string): boolean {
  return /<w:b(?:Cs)?[\s/>]/.test(runXml) && /<w:u\b[^>]*w:val="single"/.test(runXml);
}

function assertEmphasizedValue(docXml: string, value: string, contextHint: string) {
  const paras = [...docXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
  const target = paras.find((p) => {
    const plain = extractPlainText(p);
    return plain.includes(value) && plain.includes(contextHint);
  });
  assert(target, `paragraph not found for emphasized "${value}" near "${contextHint}"`);
  const runs = [...target.matchAll(/<w:r\b[\s\S]*?<\/w:r>/g)].map((m) => m[0]);
  const hit = runs.find((r) => extractPlainText(r).includes(value));
  assert(hit, `run not found for emphasized value "${value}"`);
  assert(runHasBoldUnderline(hit), `expected bold+underline for "${value}"`);
}

async function assertGeneratedContract(
  grade: "silver" | "gold" | "platinum",
  inputCompany: string
) {
  const company = normalizeContractCompanyName(inputCompany);
  const generated = await generatePartnerContractDocx({
    grade,
    companyNameContract: inputCompany,
    ceoName: "최윤호",
    businessNumber: "320-87-01210",
    contractStartDate: "2026-07-31",
    contractEndDate: "2027-07-30"
  });
  assert(generated.ok, generated.ok ? "" : `[${grade}] ${generated.message}`);
  if (!generated.ok) return;

  const zip = await JSZip.loadAsync(generated.buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  const plain = extractPlainText(xml);

  for (const token of [
    company,
    "최윤호",
    "320-87-01210",
    "2026년 07월 31일",
    "2027년 07월 30일"
  ]) {
    assert(plain.includes(token), `[${grade}] missing token: ${token}`);
  }

  assert(!plain.includes("주식회사마이데이터"), `[${grade}] glued company`);
  assert(!/주식회사\s{2,}마이데이터/.test(plain), `[${grade}] double-spaced company`);
  assert(!plain.includes("2026년 0월 0일"), `[${grade}] leftover date placeholder`);
  assert(!plain.includes("2027년 0월 0일"), `[${grade}] leftover end placeholder`);
  assert(!plain.includes("2026년 O월 OO일"), `[${grade}] leftover platinum date`);
  assert(!plain.includes("2027년 O월 OO일"), `[${grade}] leftover platinum end`);
  assert(!plain.includes("2026년 06월 30일"), `[${grade}] sample start date remained`);
  assert(!plain.includes("2027년 06월 29일"), `[${grade}] sample end date remained`);
  assert(!plain.includes("주식회사 OOOO"), `[${grade}] leftover 주식회사 OOOO`);
  assert(!plain.includes("OOOOOO"), `[${grade}] leftover OOOOOO`);
  assert(!/(?<![O])OOOOO?(?![O])/.test(plain.replaceAll(company, "")), `[${grade}] leftover OOOO`);

  assert(plain.includes(`오케스트로 주식회사`), `[${grade}] cover/vendor company`);
  assert(plain.includes(company), `[${grade}] partner company`);

  // 본문 첫 문장 회사명/계약일 강조
  assertEmphasizedValue(xml, company, "이하");
  assertEmphasizedValue(xml, "2026년 07월 31일", "벤더");
  // 제4조: 시작일/종료일 각각 강조 (부터·까지 원문 유지)
  assertEmphasizedValue(xml, "2026년 07월 31일", "유효기간");
  assertEmphasizedValue(xml, "2027년 07월 30일", "유효기간");
  const termPara = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((m) => m[0])
    .find((p) => extractPlainText(p).includes("유효기간") && extractPlainText(p).includes("부터"));
  assert(termPara, `[${grade}] term paragraph missing`);
  assert(/까지로 한다/.test(extractPlainText(termPara)), `[${grade}] term closing text`);

  // 서명란 (인) 탭
  const ceoParas = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)]
    .map((m) => m[0])
    .filter((p) => {
      const t = extractPlainText(p);
      return t.includes("대표이사 : 최윤호") && t.includes("(인)");
    });
  assert(ceoParas.length >= 1, `[${grade}] partner ceo signature missing`);
  for (const p of ceoParas) {
    assert(/<w:tabs>[\s\S]*w:val="right"/.test(p), `[${grade}] missing right tab stop`);
    assert(/<w:tab\s*\/>/.test(p), `[${grade}] missing tab before (인)`);
    const plainCeo = extractPlainText(p);
    assert(/최윤호\t\(인\)/.test(plainCeo), `[${grade}] (인) should be right-aligned via tab`);
  }

  // 출력 파일 (검수용)
  const outDir = path.join(process.cwd(), "tmp", "partner-contracts");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, generated.filename), generated.buffer);

  return generated.filename;
}

async function main() {
  // company normalize
  assert(normalizeContractCompanyName("주식회사마이데이터") === "주식회사 마이데이터", "norm glue");
  assert(normalizeContractCompanyName("주식회사  마이데이터") === "주식회사 마이데이터", "norm spaces");
  assert(normalizeContractCompanyName("(주) 마이데이터") === "(주)마이데이터", "norm (주)");
  assert(normalizeContractCompanyName("(주)마이데이터") === "(주)마이데이터", "norm (주) keep");
  assert(normalizeContractCompanyName("㈜ 마이데이터") === "㈜마이데이터", "norm ㈜");
  assert(normalizeContractCompanyName("에스피 정보시스템") === "에스피 정보시스템", "norm keep inner");

  // dates
  assert(computeContractEndDate("2026-07-31") === "2027-07-30", "end date Jul");
  assert(computeContractEndDate("2026-06-30") === "2027-06-29", "end date Jun");
  assert(formatContractKoreanDate("2026-07-31") === "2026년 07월 31일", "ko date");
  assert(formatBusinessNumberDisplay("3208701210") === "320-87-01210", "biz format");

  const founded = normalizeApplicationDate("2021년 1월");
  assert(founded.ok && founded.iso === "2021-01-01", `founded iso: ${founded.iso}`);
  assert(founded.display === "2021년 1월", `founded display: ${founded.display}`);
  assert(normalizeApplicationDate("2021년 01월").iso === "2021-01-01", "founded 01월");
  assert(normalizeApplicationDate("2021.01").iso === "2021-01-01", "founded dotted");
  assert(normalizeApplicationDate("2021-01").iso === "2021-01-01", "founded dashed");
  assert(normalizeApplicationDate("2021년").iso === "2021-01-01", "founded year");
  assert(normalizeApplicationDate("2021-01-15").iso === "2021-01-15", "founded full");

  // phones
  assert(parsePhoneFromCell("01088993107") === "010-8899-3107", "phone 11");
  assert(parsePhoneFromCell(1025562571) === "010-2556-2571", "phone 10 excel");
  assert(parsePhoneFromCell("1040572056") === "010-4057-2056", "phone 10 str");
  assert(normalizePhoneInput("010-8899-3107")?.display_phone === "010-8899-3107", "phone keep");

  const xlsxPath = path.join(process.cwd(), "tests", "fixtures", "spis-partner-application.xlsx");
  if (fs.existsSync(xlsxPath)) {
    const parsed = parsePartnerApplicationBuffer(fs.readFileSync(xlsxPath));
    assert(parsed.company.company_name_raw?.includes("에스피정보시스템"), "company name");
    assert(parsed.contract_contact?.name === "김석현", "contract contact");
    if (parsed.contract_contact?.phone) {
      assert(
        normalizePhoneInput(parsed.contract_contact.phone)?.display_phone?.startsWith("010-"),
        `contact phone normalized: ${parsed.contract_contact.phone}`
      );
    }
  }

  const files = [];
  for (const grade of ["silver", "gold", "platinum"] as const) {
    files.push(await assertGeneratedContract(grade, "주식회사마이데이터"));
  }

  console.log("OK: partner contract formatting tests passed");
  console.log("Generated:", files.join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
