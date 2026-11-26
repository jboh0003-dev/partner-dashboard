import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createConverter } from "@deepseek-ai/libreoffice-kit";

export async function renderPartnerContractPdf(docx: Buffer) {
  const directory = await mkdtemp(path.join(tmpdir(), "partner-contract-"));
  try {
    const inputPath = path.join(directory, "contract.docx");
    const outputPath = path.join(directory, "contract.pdf");
    await writeFile(inputPath, docx);
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
