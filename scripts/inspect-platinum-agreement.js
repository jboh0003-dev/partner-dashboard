const JSZip = require("jszip");
const fs = require("fs");

async function main() {
  const buf = fs.readFileSync("templates/partner-contracts/platinum-agreement-v1.1.docx");
  const z = await JSZip.loadAsync(buf);
  const xml = await z.file("word/document.xml").async("string");
  const text = xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  console.log(text);
}

main().catch(console.error);
