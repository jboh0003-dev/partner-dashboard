/**
 * 최소 PPTX 생성 후 Supabase 업로드 E2E 검증
 *
 * Usage: npx tsx scripts/test-policy-upload-e2e.ts
 */
import JSZip from "jszip";
import { createClient } from "@supabase/supabase-js";
import { parsePptxBuffer } from "../src/lib/policy/parse-pptx";
import { buildPolicyStoragePath, ensurePartnerPolicyBucket } from "../src/lib/policy/storage";
import { PARTNER_POLICY_BUCKET } from "../src/lib/policy/constants";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>Partner Type</a:t></a:r></a:p>
    <a:p><a:r><a:t>Platinum 파트너는 Sales/Technical Support 역할을 수행하며 기술자격 Level 2 기준이 적용됩니다.</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

const SLIDE2_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:sp><p:txBody><a:p><a:r><a:t>영업기회 등록</a:t></a:r></a:p>
    <a:p><a:r><a:t>영업기회 등록은 파트너 포털 Deal Registration 메뉴에서 진행합니다.</a:t></a:r></a:p></p:txBody></p:sp>
  </p:spTree></p:cSld>
</p:sld>`;

async function buildMinimalPptx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`
  );
  zip.file(
    "ppt/presentation.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst>
</p:presentation>`
  );
  zip.file("ppt/slides/slide1.xml", SLIDE_XML);
  zip.file("ppt/slides/slide2.xml", SLIDE2_XML);
  return zip.generateAsync({ type: "arraybuffer" });
}

async function main() {
  if (!url || !key) {
    console.error("Supabase 환경변수가 필요합니다.");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const buffer = await buildMinimalPptx();
  const parsed = await parsePptxBuffer(buffer);

  console.log(`파싱: ${parsed.total_slides}슬라이드, ${parsed.total_chunks}청크`);

  const documentId = crypto.randomUUID();
  const effectiveDate = "2026-06-23";
  const storagePath = buildPolicyStoragePath(effectiveDate, documentId, "test-policy.pptx");

  await ensurePartnerPolicyBucket(supabase);

  const { error: unsetError } = await supabase
    .from("partner_policy_documents")
    .update({ is_current: false, updated_at: new Date().toISOString() })
    .eq("is_current", true);
  if (unsetError) throw new Error(unsetError.message);

  const { error: uploadError } = await supabase.storage
    .from(PARTNER_POLICY_BUCKET)
    .upload(storagePath, buffer, { contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const { error: docError } = await supabase.from("partner_policy_documents").insert({
    id: documentId,
    policy_title: "2026년 OKESTRO Partner Program",
    version_label: "2026.06.23 업데이트 (E2E)",
    effective_date: effectiveDate,
    source_file_name: "test-policy.pptx",
    storage_path: storagePath,
    file_type: "pptx",
    file_size: buffer.byteLength,
    description: "E2E 테스트 업로드",
    change_memo: "자동 테스트",
    is_current: true,
    status: "active",
    uploaded_by: "e2e-script"
  });
  if (docError) throw new Error(docError.message);

  const chunkRows = parsed.slides.flatMap((slide) =>
    slide.chunks.map((chunk) => ({
      policy_document_id: documentId,
      section_title: chunk.section_title,
      category: slide.category,
      slide_number: slide.slide_number,
      content: chunk.content,
      keywords: chunk.keywords,
      raw_json: { slide_title: slide.title, slide_body: slide.body }
    }))
  );

  const { error: chunkError } = await supabase.from("partner_policy_chunks").insert(chunkRows);
  if (chunkError) throw new Error(chunkError.message);

  const { data: signed } = await supabase.storage.from(PARTNER_POLICY_BUCKET).createSignedUrl(storagePath, 60);
  const downloadOk = Boolean(signed?.signedUrl);

  const { policyChunksToKnowledgeRows, searchPartnerKnowledge } = await import("../src/lib/search/knowledge");
  const { data: doc } = await supabase.from("partner_policy_documents").select("*").eq("id", documentId).single();
  const { data: chunks } = await supabase.from("partner_policy_chunks").select("*").eq("policy_document_id", documentId);

  const rows = policyChunksToKnowledgeRows(doc as never, (chunks ?? []) as never);
  const gradeHit = searchPartnerKnowledge("파트너 등급 기준 알려줘", rows, 1)[0];
  const dealHit = searchPartnerKnowledge("영업기회 등록 절차 알려줘", rows, 1)[0];

  const checks = [
    { label: "슬라이드 추출", ok: parsed.total_slides >= 2 },
    { label: "청크 저장", ok: chunkRows.length > 0 },
    { label: "최신 정책 적용", ok: doc?.is_current === true },
    { label: "다운로드 URL", ok: downloadOk },
    { label: "등급 질문", ok: /Platinum|등급/.test(gradeHit?.content ?? "") },
    { label: "영업기회 질문", ok: /영업기회|Deal Registration/.test(dealHit?.content ?? "") },
    { label: "버전명 포함", ok: gradeHit?.source?.includes("2026.06.23") ?? false }
  ];

  let failed = 0;
  for (const check of checks) {
    console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.label}`);
    if (!check.ok) failed += 1;
  }

  if (failed > 0) process.exit(1);
  console.log("\nE2E 업로드·검색 검증 통과 (document_id:", documentId, ")");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
