/**
 * 파트너 정책 검색·OKE AI 연동 로직 검증
 *
 * Usage: npx tsx scripts/test-policy-search.ts [path/to/policy.pptx]
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parsePptxBuffer } from "../src/lib/policy/parse-pptx";
import {
  policyChunksToKnowledgeRows,
  searchPartnerKnowledge
} from "../src/lib/search/knowledge";
import type { PartnerPolicyChunk, PartnerPolicyDocument } from "../src/types/partner-policy";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testPptxParsing(filePath?: string) {
  if (!filePath || !existsSync(filePath)) {
    console.log("SKIP  PPTX 파일 없음 — 파싱 테스트 생략");
    return true;
  }

  const buffer = readFileSync(filePath).buffer.slice(
    readFileSync(filePath).byteOffset,
    readFileSync(filePath).byteOffset + readFileSync(filePath).byteLength
  );
  const parsed = await parsePptxBuffer(buffer);

  const ok =
    parsed.total_slides > 0 &&
    parsed.total_chunks > 0 &&
    parsed.slides.every((slide) => slide.slide_number > 0 && slide.chunks.length > 0);

  console.log(`${ok ? "PASS" : "FAIL"}  PPTX 파싱 (${parsed.total_slides}슬라이드, ${parsed.total_chunks}청크)`);
  if (!ok) return false;

  const sample = parsed.slides[0];
  console.log(`      샘플: 슬라이드 ${sample.slide_number} · ${sample.title.slice(0, 40)} · ${sample.category}`);
  return true;
}

function testSearchLogic() {
  const document: PartnerPolicyDocument = {
    id: "doc-test",
    policy_title: "2026년 OKESTRO Partner Program",
    version_label: "2026.06.23 업데이트",
    effective_date: "2026-06-23",
    source_file_name: "policy.pptx",
    storage_path: "2026/2026-06-23/test/policy.pptx",
    file_type: "pptx",
    file_size: 1000,
    description: null,
    change_memo: null,
    is_current: true,
    status: "active",
    uploaded_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const chunks: PartnerPolicyChunk[] = [
    {
      id: "c1",
      policy_document_id: "doc-test",
      section_title: "Partner Type",
      category: "Partner Type",
      slide_number: 5,
      page_number: null,
      content:
        "[슬라이드 5] Platinum 파트너는 Sales/Technical Support 역할을 수행하며, 기술자격 Level 2, PoC 장비 상시 보유, 영업인력 2명, 기술인력 2명, 매출 목표 10억 기준이 적용됩니다.",
      keywords: ["Platinum", "등급", "파트너"],
      raw_json: null,
      created_at: new Date().toISOString()
    },
    {
      id: "c2",
      policy_document_id: "doc-test",
      section_title: "영업기회 등록",
      category: "Deal Registration",
      slide_number: 18,
      page_number: null,
      content:
        "[슬라이드 18] 영업기회 등록은 파트너 포털에서 Deal Registration 메뉴를 통해 진행하며, 고객사·예상 매출·제품 정보를 입력 후 승인을 받습니다.",
      keywords: ["영업기회", "Deal Registration"],
      raw_json: null,
      created_at: new Date().toISOString()
    }
  ];

  const rows = policyChunksToKnowledgeRows(document, chunks);
  const gradeHits = searchPartnerKnowledge("파트너 등급 기준 알려줘", rows, 3);
  const dealHits = searchPartnerKnowledge("영업기회 등록 절차 알려줘", rows, 3);

  const gradeOk = gradeHits.length > 0 && /Platinum|등급/.test(gradeHits[0].content);
  const dealOk = dealHits.length > 0 && /영업기회|Deal Registration/.test(dealHits[0].content);
  const sourceOk = gradeHits[0]?.source?.includes("2026.06.23") ?? false;

  console.log(`${gradeOk ? "PASS" : "FAIL"}  등급 질문 검색`);
  console.log(`${dealOk ? "PASS" : "FAIL"}  영업기회 등록 질문 검색`);
  console.log(`${sourceOk ? "PASS" : "FAIL"}  검색 결과에 버전명 포함`);

  return gradeOk && dealOk && sourceOk;
}

async function testDatabase() {
  if (!url || !key) {
    console.log("SKIP  Supabase 환경변수 없음");
    return true;
  }

  const supabase = createClient(url, key);
  const { error: docError } = await supabase.from("partner_policy_documents").select("id").limit(1);
  const { error: chunkError } = await supabase.from("partner_policy_chunks").select("id").limit(1);

  const tablesOk = !docError && !chunkError;
  console.log(`${tablesOk ? "PASS" : "FAIL"}  partner_policy_documents / partner_policy_chunks 테이블`);

  if (!tablesOk) {
    console.log(`      ${docError?.message ?? chunkError?.message}`);
    return false;
  }

  const { data: current } = await supabase
    .from("partner_policy_documents")
    .select("id, version_label, effective_date, is_current")
    .eq("is_current", true)
    .eq("status", "active")
    .maybeSingle();

  if (current) {
    const { count } = await supabase
      .from("partner_policy_chunks")
      .select("id", { count: "exact", head: true })
      .eq("policy_document_id", current.id);
    console.log(
      `INFO  최신 정책: ${current.version_label} (기준일 ${current.effective_date}, 청크 ${count ?? 0}건)`
    );
  } else {
    console.log("INFO  등록된 최신 정책 없음 — 업로드 필요");
  }

  return true;
}

async function main() {
  const pptxPath = process.argv[2];
  let failed = 0;

  if (!(await testPptxParsing(pptxPath))) failed += 1;
  if (!testSearchLogic()) failed += 1;
  if (!(await testDatabase())) failed += 1;

  if (failed > 0) {
    console.log(`\n${failed}개 검증 실패`);
    process.exit(1);
  }

  console.log("\n파트너 정책 검색 로직 검증 통과");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
