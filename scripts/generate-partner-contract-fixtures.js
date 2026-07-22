/**
 * 등급별 계약서 템플릿 / SPIS 기준본 fixture 생성
 * 실제 업무용 원본 DOCX가 있으면 이 파일을 덮어쓰세요.
 * (디자인·조항 문구는 원본을 유지하고 값만 치환하는 구조입니다.)
 */
const FS = require("fs");
const path = require("path");
const JSZip = require("jszip");

async function makeDocx(filePath, paragraphs) {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.folder("_rels").file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.folder("word").folder("_rels").file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`
  );

  const body = paragraphs
    .map((t) => {
      const escaped = String(t)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
    })
    .join("");

  zip.folder("word").file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr/></w:body>
</w:document>`
  );

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  FS.mkdirSync(path.dirname(filePath), { recursive: true });
  FS.writeFileSync(filePath, buf);
  console.log("wrote", filePath);
}

function templateParagraphs(gradeLabel) {
  return [
    `파트너 계약서 (${gradeLabel})`,
    "계약일: 【계약일】",
    "파트너: OOOOOO",
    "OOOOOO(이하 “파트너”)와 오케스트로는 【계약일】 다음과 같이 계약을 체결한다.",
    "제4조 (계약기간) 본 계약은 【계약시작일】부터 【계약종료일】까지로 한다.",
    "서명일: 【계약일】",
    "상호: 【상호】",
    "사업자등록번호: 【사업자등록번호】",
    "대표이사: 【대표이사】",
    "부속합의서: OOOOOO 관련 부속합의",
    "부속 서명일: 【계약일】",
    "부속 상호: 【상호】",
    "부속 사업자등록번호: 【사업자등록번호】",
    "부속 대표이사: 【대표이사】"
  ];
}

async function main() {
  const dir = path.join(process.cwd(), "templates", "partner-contracts");
  await makeDocx(path.join(dir, "silver.docx"), templateParagraphs("실버"));
  await makeDocx(path.join(dir, "gold.docx"), templateParagraphs("골드"));
  await makeDocx(path.join(dir, "platinum.docx"), templateParagraphs("플래티넘"));

  const company = "주식회사 에스피정보시스템";
  const ceo = "김혜선";
  const biz = "160-87-02034";
  const start = "2026년 06월 30일";
  const end = "2027년 06월 29일";
  await makeDocx(path.join(process.cwd(), "tests", "fixtures", "spis-silver-reference.docx"), [
    "파트너 계약서 (실버)",
    `계약일: ${start}`,
    `파트너: ${company}`,
    `${company}(이하 “파트너”)와 오케스트로는 ${start} 다음과 같이 계약을 체결한다.`,
    `제4조 (계약기간) 본 계약은 ${start}부터 ${end}까지로 한다.`,
    `서명일: ${start}`,
    `상호: ${company}`,
    `사업자등록번호: ${biz}`,
    `대표이사: ${ceo}`,
    `부속합의서: ${company} 관련 부속합의`,
    `부속 서명일: ${start}`,
    `부속 상호: ${company}`,
    `부속 사업자등록번호: ${biz}`,
    `부속 대표이사: ${ceo}`
  ]);

  // SPIS 신청서 fixture (xlsx)
  const XLSX = require("xlsx");
  const appRows = [];
  // Build a sheet with labels in known cells via AOA then set named cells roughly
  const aoa = Array.from({ length: 25 }, () => Array.from({ length: 12 }, () => ""));
  aoa[5][2] = "기업명";
  aoa[5][3] = "㈜에스피정보시스템";
  aoa[5][6] = "사업자등록번호";
  aoa[5][7] = "160-87-02034";
  aoa[6][2] = "대표자명";
  aoa[6][3] = "김혜선";
  aoa[6][6] = "홈페이지";
  aoa[6][7] = "https://www.spis.co.kr";
  aoa[7][2] = "설립일자";
  aoa[7][3] = "1999-01-01";
  aoa[7][6] = "신용등급";
  aoa[7][7] = "A";
  aoa[8][2] = "주소";
  aoa[8][3] = "서울시";
  aoa[8][6] = "매출액";
  aoa[8][7] = "100억";
  aoa[9][2] = "전체 임직원";
  aoa[9][3] = "100";
  aoa[9][6] = "전담 영업인원 수";
  aoa[9][7] = "1";
  aoa[10][2] = "전체 엔지니어";
  aoa[10][3] = "20";
  aoa[10][6] = "전담 기술인원 수";
  aoa[10][7] = "1";
  aoa[13][2] = "성명";
  aoa[13][3] = "김석현";
  aoa[13][6] = "직급/직책";
  aoa[13][7] = "과장";
  aoa[14][2] = "부서";
  aoa[14][3] = "영업팀";
  aoa[14][6] = "직통번호";
  aoa[14][7] = "02-1234-5678";
  aoa[15][2] = "휴대폰";
  aoa[15][3] = "01012345678";
  aoa[15][6] = "이메일";
  aoa[15][7] = "shkim@spis.co.kr";

  const staff = [
    ["영업 전담인원"],
    ["담당 업무", "부서", "이름", "직급/직책", "휴대폰", "이메일", "비고"],
    ["영업", "영업팀", "김석현", "과장", "01012345678", "shkim@spis.co.kr", ""],
    ["기술 전담인원"],
    ["담당 업무", "부서", "이름", "직급/직책", "휴대폰", "이메일", "비고", "기술숙련도", "주요 기술"],
    ["기술", "기술팀", "류지욱", "책임", "01099998888", "jwryoo@spis.co.kr", "", "상", "클라우드"]
  ];

  const wb = XLSX.utils.book_new();
  const appSheet = XLSX.utils.aoa_to_sheet(aoa);
  const staffSheet = XLSX.utils.aoa_to_sheet(staff);
  XLSX.utils.book_append_sheet(wb, appSheet, "0. 파트너 신청서");
  XLSX.utils.book_append_sheet(wb, staffSheet, "1. 전담 인원");
  const xlsxPath = path.join(process.cwd(), "tests", "fixtures", "spis-partner-application.xlsx");
  XLSX.writeFile(wb, xlsxPath);
  console.log("wrote", xlsxPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
