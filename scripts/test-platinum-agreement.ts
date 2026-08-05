import { generatePlatinumAgreementDocx } from "../src/lib/platinum-upgrade/generate-agreement";
import { generatePlatinumAgreementPdf } from "../src/lib/platinum-upgrade/generate-agreement-pdf";

async function main() {
  const input = {
    companyName: "주식회사 테스트파트너",
    ceoName: "홍길동",
    businessNumber: "123-45-67890",
    agreementDate: "2026-07-22"
  };
  const docx = await generatePlatinumAgreementDocx(input);
  console.log("docx", docx.ok, docx.ok ? docx.filename : docx.message);
  if (!docx.ok) process.exit(1);
  console.log("has company", docx.plainText.includes("주식회사 테스트파트너"));
  console.log("has date", docx.plainText.includes("2026년 07월 22일"));
  console.log("has ooooo", docx.plainText.includes("OOOOO"));
  console.log("has ceo line", docx.plainText.includes("대표이사 : 홍길동"));
  console.log("has biz", docx.plainText.includes("123-45-67890"));

  const pdf = await generatePlatinumAgreementPdf(input);
  console.log("pdf", pdf.ok, pdf.ok ? `${pdf.filename} ${pdf.buffer.length}` : pdf.message);
  if (!pdf.ok) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
