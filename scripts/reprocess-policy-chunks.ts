/**
 * 업로드된 정책 문서 chunk 재처리
 *
 * Usage: npx tsx scripts/reprocess-policy-chunks.ts [document_id]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reprocessPolicyDocumentChunks } from "../src/lib/policy/reprocess-document";
import { isBadParseContent } from "../src/lib/policy/xml-text";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx);
      const value = trimmed.slice(idx + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");

  const supabase = createClient(url, key);

  let documentId = process.argv[2];
  if (!documentId) {
    const { data } = await supabase
      .from("partner_policy_documents")
      .select("id, source_file_name")
      .ilike("source_file_name", "%260623%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) throw new Error("260623 정책 문서를 찾을 수 없습니다.");
    documentId = String(data.id);
    console.log("대상 문서:", data.source_file_name, documentId);
  }

  const result = await reprocessPolicyDocumentChunks(supabase, documentId);
  console.log("재처리 완료:", result);

  const { data: chunks } = await supabase
    .from("partner_policy_chunks")
    .select("content, is_active, parse_status")
    .eq("policy_document_id", documentId);

  const active = (chunks ?? []).filter((c) => c.is_active !== false && c.parse_status !== "bad_parse");
  const xmlActive = active.filter((c) => isBadParseContent(String(c.content))).length;
  console.log(`active chunks: ${active.length}, xml in active: ${xmlActive}`);

  if (xmlActive > 0) {
    console.error("FAIL: active chunk에 XML 태그가 남아 있습니다.");
    process.exit(1);
  }

  console.log("PASS: chunk 재처리 검증 완료");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
