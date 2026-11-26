import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createConverter } from "@deepseek-ai/libreoffice-kit";

import JSZip from "jszip";

async function fitCoverForPdf(docx: Buffer) {
  const archive = await JSZip.loadAsync(docx);
  const part = "word/document.xml";
  const xml = await archive.file(part)!.async("string");
  const pageBreak = xml.indexOf('<w:br w:type="page"');
  if (pageBreak < 0) return docx;
  // Word's empty cover spacer paragraphs expand with the PDF renderer's font metrics.
  const cover = xml.slice(0, pageBreak).replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, paragraph => {
    const spacerStyle = /<w:pStyle w:val="a0"\s*\/>/;
    if (!spacerStyle.test(paragraph) ||
        /<w:(?:r|t|drawing|pict|br|sectPr)\b/.test(paragraph)) return paragraph;
    return paragraph.replace(spacerStyle,
      '<w:pStyle w:val="a0"/><w:spacing w:before="0" w:after="0" w:line="80" w:lineRule="exact"/>');
  });
  archive.file(part, cover + xml.slice(pageBreak));
  return archive.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export async function renderPartnerContractPdf(docx: Buffer) {
  const directory = await mkdtemp(path.join(tmpdir(), "partner-contract-"));
  try {
    const inputPath = path.join(directory, "contract.docx");
    const outputPath = path.join(directory, "contract.pdf");
    await writeFile(inputPath, await fitCoverForPdf(docx));
    const converter = await createConverter({
      timeoutMs: 90_000,
      fontDirectories: [path.join(process.cwd(), "assets/fonts")]
    });
    try {
      await converter.render({ inputPath, outputPath });
      return await readFile(outputPath);
    } finally {
      await converter.dispose();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
