import { createClient } from "@supabase/supabase-js";
import { parsePptxBuffer } from "../src/lib/policy/parse-pptx";
import { isBadParseContent } from "../src/lib/policy/xml-text";
import { writeFileSync } from "node:fs";

async function main() {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: doc } = await s
    .from("partner_policy_documents")
    .select("*")
    .ilike("source_file_name", "%260623%")
    .eq("is_current", true)
    .maybeSingle();
  if (!doc) throw new Error("doc not found");

  const { data: blob, error } = await s.storage.from("partner-policy-documents").download(doc.storage_path);
  if (error || !blob) throw new Error(error?.message ?? "download failed");
  const buffer = await blob.arrayBuffer();
  writeFileSync("tmp-policy.pptx", Buffer.from(buffer));

  const parsed = await parsePptxBuffer(buffer);
  console.log("slides", parsed.total_slides, "chunks", parsed.total_chunks);
  let bad = 0;
  for (const slide of parsed.slides) {
    for (const chunk of slide.chunks) {
      if (isBadParseContent(chunk.content)) {
        bad += 1;
        console.log("BAD slide", slide.slide_number, chunk.content.slice(0, 120));
      }
    }
  }
  console.log("bad chunks", bad);
  const varSlide = parsed.slides.find((s) => /platinum|gold|silver|service/i.test(`${s.title} ${s.body}`));
  if (varSlide) {
    console.log("VAR slide", varSlide.slide_number, varSlide.title);
    console.log(varSlide.body.slice(0, 800));
  }
}

main();
