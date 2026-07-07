/**
 * OKE AI policy_lookup 응답 형식 검증
 *
 * Usage: npx tsx scripts/test-policy-oke-ai.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { filterUsablePolicyChunks } from "../src/lib/data/partner-policy";
import { policyChunksToKnowledgeRows, searchPartnerKnowledge } from "../src/lib/search/knowledge";
import { runSearch } from "../src/lib/search/engine";
import type { SearchContext } from "../src/lib/data/search";
import type { PartnerPolicyChunk, PartnerPolicyDocument } from "../src/types/partner-policy";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      if (!process.env[t.slice(0, i)]) process.env[t.slice(0, i)] = t.slice(i + 1);
    }
  } catch {
    // ignore
  }
}

function mapDocument(row: Record<string, unknown>): PartnerPolicyDocument {
  return row as unknown as PartnerPolicyDocument;
}

function mapChunk(row: Record<string, unknown>): PartnerPolicyChunk {
  return {
    id: String(row.id),
    policy_document_id: String(row.policy_document_id),
    section_title: row.section_title ? String(row.section_title) : null,
    category: row.category ? String(row.category) : null,
    slide_number: row.slide_number != null ? Number(row.slide_number) : null,
    page_number: row.page_number != null ? Number(row.page_number) : null,
    content: String(row.content),
    keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : null,
    raw_json: (row.raw_json as Record<string, unknown> | null) ?? null,
    is_active: row.is_active !== false,
    parse_status: row.parse_status ? String(row.parse_status) : "active",
    created_at: String(row.created_at)
  };
}

async function buildPolicyContext(): Promise<SearchContext> {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);
  const { data: policyDocumentData } = await supabase
    .from("partner_policy_documents")
    .select("*")
    .eq("is_current", true)
    .eq("status", "active")
    .maybeSingle();

  const policyDocument = policyDocumentData ? mapDocument(policyDocumentData) : null;
  let policyChunks: PartnerPolicyChunk[] = [];

  if (policyDocument?.id) {
    const { data } = await supabase
      .from("partner_policy_chunks")
      .select("*")
      .eq("policy_document_id", policyDocument.id);
    policyChunks = filterUsablePolicyChunks((data ?? []).map((row) => mapChunk(row as Record<string, unknown>)));
  }

  return {
    partners: [],
    contacts: [],
    assets: [],
    documents: [],
    pocs: [],
    attendances: [],
    trainings: [],
    knowledge: [],
    policyDocument,
    policyChunks,
    previousPolicyDocument: null,
    previousPolicyChunks: [],
    notes: [],
    events: [],
    eventDocuments: [],
    fetchedAt: new Date().toISOString()
  };
}

async function main() {
  const context = await buildPolicyContext();
  const queries = ["파트너 등급 기준 알려줘", "영업기회 등록 절차 알려줘"];
  let failed = 0;

  for (const query of queries) {
    const result = runSearch(query, context);
    const hasVersion = result.answer.includes("기준일");
    const hasStrategic = /\bstrategic\b/i.test(result.answer);
    const hasContent = !result.empty && result.answer.length > 20;
    const ok = result.intent === "policy_lookup" && hasVersion && hasContent && !hasStrategic;

    console.log(`${ok ? "PASS" : "FAIL"}  "${query}"`);
    console.log(`      intent=${result.intent} empty=${result.empty} strategic=${hasStrategic}`);
    console.log(`      ${result.answer.slice(0, 140)}…`);
    if (!ok) failed += 1;
  }

  if (context.policyDocument && context.policyChunks.length > 0) {
    const rows = policyChunksToKnowledgeRows(context.policyDocument, context.policyChunks);
    const miss = searchPartnerKnowledge("qwertyuiopasdfghjklzxcvbnm", rows, 1);
    const missOk = miss.length === 0;
    console.log(`${missOk ? "PASS" : "FAIL"}  미등록 내용 → 검색 결과 없음`);
    if (!missOk) failed += 1;
  } else {
    console.log("SKIP  policy chunks 없음");
  }

  if (failed > 0) process.exit(1);
  console.log("\nOKE AI 정책 응답 검증 통과");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
