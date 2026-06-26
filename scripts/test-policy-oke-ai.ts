/**
 * OKE AI policy_lookup 응답 형식 검증
 *
 * Usage: npx tsx scripts/test-policy-oke-ai.ts
 */
import { createClient } from "@supabase/supabase-js";
import { policyChunksToKnowledgeRows, searchPartnerKnowledge } from "../src/lib/search/knowledge";
import { runSearch } from "../src/lib/search/engine";
import type { SearchContext } from "../src/lib/data/search";
import type { PartnerPolicyChunk, PartnerPolicyDocument } from "../src/types/partner-policy";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function mapDocument(row: Record<string, unknown>): PartnerPolicyDocument {
  return row as unknown as PartnerPolicyDocument;
}

async function buildPolicyContext(): Promise<Pick<SearchContext, "policyDocument" | "policyChunks" | "previousPolicyDocument" | "previousPolicyChunks" | "knowledge" | "partners" | "contacts" | "assets" | "documents" | "pocs" | "attendances" | "trainings" | "notes" | "events" | "eventDocuments" | "fetchedAt">> {
  const supabase = createClient(url!, key!);
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
    policyChunks = (data ?? []) as PartnerPolicyChunk[];
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
  if (!url || !key) {
    console.error("Supabase 환경변수가 필요합니다.");
    process.exit(1);
  }

  const context = await buildPolicyContext();
  const queries = ["파트너 등급 기준 알려줘", "영업기회 등록 절차 알려줘"];
  let failed = 0;

  for (const query of queries) {
    const result = runSearch(query, context as SearchContext);
    const hasVersion =
      result.answer.includes("2026.06.23") || result.answer.includes("기준일");
    const hasContent = !result.empty && result.answer.length > 20;
    const ok = result.intent === "policy_lookup" && hasVersion && hasContent;

    console.log(`${ok ? "PASS" : "FAIL"}  "${query}"`);
    console.log(`      intent=${result.intent} empty=${result.empty}`);
    console.log(`      ${result.answer.slice(0, 140)}…`);
    if (!ok) failed += 1;
  }

  if (context.policyDocument && context.policyChunks.length > 0) {
    const rows = policyChunksToKnowledgeRows(context.policyDocument, context.policyChunks);
    const miss = searchPartnerKnowledge("존재하지 않는 정책 항목 xyz123", rows, 1);
    const missOk = miss.length === 0;
    console.log(`${missOk ? "PASS" : "FAIL"}  미등록 내용 → 검색 결과 없음`);
    if (!missOk) failed += 1;
  }

  if (failed > 0) process.exit(1);
  console.log("\nOKE AI 정책 응답 검증 통과");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
