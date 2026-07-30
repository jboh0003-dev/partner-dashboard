/**
 * Build partner-application-2026.xlsx from fixture layout + required extra sheets.
 * Official v7 blank can replace this file later; keep excel-mapping.ts in sync.
 */
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

async function main() {
  const root = path.join(__dirname, "..");
  const outDir = path.join(root, "templates", "partner-applications");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "partner-application-2026.xlsx");

  const fixturePath = path.join(root, "tests", "fixtures", "spis-partner-application.xlsx");
  const workbook = new ExcelJS.Workbook();

  if (fs.existsSync(fixturePath)) {
    await workbook.xlsx.readFile(fixturePath);
  }

  // Rebuild staff sheet to match STAFF_SHEET_LAYOUT (ceo / sales / engineer sections)
  let staff = workbook.getWorksheet("1. 전담 인원");
  if (staff) workbook.removeWorksheet(staff.id);
  staff = workbook.addWorksheet("1. 전담 인원");
  staff.getCell("A1").value = "대표이사";
  ["담당 업무", "부서", "이름", "직급/직책", "휴대폰", "이메일", "비고"].forEach((h, i) => {
    staff.getCell(2, i + 1).value = h;
  });
  staff.getCell("A4").value = "영업 전담인원";
  ["담당 업무", "부서", "이름", "직급/직책", "휴대폰", "이메일", "비고"].forEach((h, i) => {
    staff.getCell(5, i + 1).value = h;
  });
  staff.getCell("A16").value = "기술 전담인원";
  [
    "담당 업무",
    "부서",
    "이름",
    "직급/직책",
    "휴대폰",
    "이메일",
    "비고",
    "기술숙련도",
    "주요 기술"
  ].forEach((h, i) => {
    staff.getCell(17, i + 1).value = h;
  });

  // Ensure sheet 0 labels for flags
  const app = workbook.getWorksheet("0. 파트너 신청서") || workbook.addWorksheet("0. 파트너 신청서");
  if (!app.getCell("C6").value) {
    const labels = [
      ["C6", "기업명"],
      ["G6", "사업자등록번호"],
      ["C7", "대표자명"],
      ["G7", "홈페이지"],
      ["C8", "설립일자"],
      ["G8", "신용등급"],
      ["C9", "주소"],
      ["G9", "매출액"],
      ["C10", "전체 임직원"],
      ["G10", "전담 영업인원 수"],
      ["C11", "전체 엔지니어"],
      ["G11", "전담 기술인원 수"],
      ["C14", "성명"],
      ["G14", "직급/직책"],
      ["C15", "부서"],
      ["G15", "직통번호"],
      ["C16", "휴대폰"],
      ["G16", "이메일"],
      ["C18", "기술협력 신청"],
      ["G18", "플래티넘 검토"]
    ];
    for (const [addr, val] of labels) app.getCell(addr).value = val;
  } else {
    app.getCell("C18").value = app.getCell("C18").value || "기술협력 신청";
    app.getCell("G18").value = app.getCell("G18").value || "플래티넘 검토";
  }

  function ensureSheet(name, headers, title) {
    let ws = workbook.getWorksheet(name);
    if (ws) workbook.removeWorksheet(ws.id);
    ws = workbook.addWorksheet(name);
    if (title) ws.getCell("A1").value = title;
    headers.forEach((h, i) => {
      ws.getCell(2, i + 1).value = h;
    });
    return ws;
  }

  ensureSheet(
    "2. 주요고객 및 영업계획",
    ["고객명", "제안 상황", "사업 시기", "매출 목표", "비고"],
    "주요고객 및 영업계획"
  );

  let strategy = workbook.getWorksheet("3. 영업전략");
  if (strategy) workbook.removeWorksheet(strategy.id);
  strategy = workbook.addWorksheet("3. 영업전략");
  strategy.getCell("A1").value = "영업전략";
  strategy.getCell("A2").value = "";

  ensureSheet("4. 장비현황", ["장비명", "모델", "수량", "비고"], "장비현황");
  ensureSheet(
    "5. 기술인력프로필(1)",
    ["이름", "경력(년)", "주요기술", "자격증", "비고"],
    "기술인력 프로필 (1)"
  );
  ensureSheet(
    "5. 기술인력프로필(2)",
    ["이름", "경력(년)", "주요기술", "자격증", "비고"],
    "기술인력 프로필 (2)"
  );

  // Clear sample values from fixture company sheet value cells (keep labels)
  const clearAddrs = [
    "D6",
    "H6",
    "D7",
    "H7",
    "D8",
    "H8",
    "D9",
    "H9",
    "D10",
    "H10",
    "D11",
    "H11",
    "D14",
    "H14",
    "D15",
    "H15",
    "D16",
    "H16",
    "D18",
    "H18"
  ];
  for (const addr of clearAddrs) {
    if (app.getCell(addr).value && !String(app.getCell(addr).value).includes("기업")) {
      // only clear if it looks like sample data (has company name etc) — clear all value cells
    }
    const labelCells = new Set([
      "C6",
      "G6",
      "C7",
      "G7",
      "C8",
      "G8",
      "C9",
      "G9",
      "C10",
      "G10",
      "C11",
      "G11",
      "C14",
      "G14",
      "C15",
      "G15",
      "C16",
      "G16",
      "C18",
      "G18"
    ]);
    if (!labelCells.has(addr)) app.getCell(addr).value = null;
  }

  await workbook.xlsx.writeFile(outPath);
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
