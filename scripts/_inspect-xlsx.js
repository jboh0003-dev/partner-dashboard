const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const file = path.join("tests/fixtures/spis-partner-application.xlsx");
const wb = XLSX.readFile(file);
const out = [];
out.push("sheets: " + JSON.stringify(wb.SheetNames));
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  out.push("\n==== " + name + " " + (ws["!ref"] || ""));
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  out.push("rows " + data.length);
  data.slice(0, 50).forEach((row, i) => {
    const parts = [];
    row.forEach((c, j) => {
      if (c !== "" && c != null) {
        parts.push(XLSX.utils.encode_cell({ r: i, c: j }) + "=" + String(c).replace(/\n/g, " ").slice(0, 60));
      }
    });
    if (parts.length) out.push("R" + (i + 1) + ": " + parts.join(" | "));
  });
}
fs.writeFileSync("scripts/output/_xlsx-inspect.txt", out.join("\n"), "utf8");
console.log("wrote scripts/output/_xlsx-inspect.txt lines", out.length);
