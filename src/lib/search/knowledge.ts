import { PARTNER_POLICY_SECTIONS } from "@/lib/policy/partner-policy";
import type { PartnerPolicyChunk, PartnerPolicyDocument } from "@/types/partner-policy";

export type PartnerKnowledgeRow = {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  source: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  updated_at: string | null;
};

export type KnowledgeSearchHit = PartnerKnowledgeRow & {
  score: number;
  slide_number?: number | null;
};

const CATEGORY_TO_KNOWLEDGE: Record<string, string> = {
  Overview: "정책",
  "Partner Type": "등급",
  "Profit Program": "정책",
  "Technical Program": "교육",
  "Support Program": "정책",
  "Contract Process": "계약",
  "Deal Registration": "운영기준",
  "KPI / Goal": "운영기준",
  Appendix: "FAQ",
  기타: "기타"
};

export function policyChunksToKnowledgeRows(
  document: PartnerPolicyDocument,
  chunks: PartnerPolicyChunk[]
): PartnerKnowledgeRow[] {
  return chunks.map((chunk, index) => ({
    id: `policy-chunk-${chunk.id}`,
    category: CATEGORY_TO_KNOWLEDGE[chunk.category ?? ""] ?? "정책",
    title: chunk.section_title ?? `슬라이드 ${chunk.slide_number ?? index + 1}`,
    content: chunk.slide_number
      ? `[슬라이드 ${chunk.slide_number}] ${chunk.content}`
      : chunk.content,
    keywords: [
      ...(chunk.keywords ?? []),
      document.version_label,
      document.policy_title,
      chunk.category ?? ""
    ]
      .filter(Boolean)
      .join(","),
    source: `${document.version_label} · ${document.source_file_name}`,
    sort_order: (chunk.slide_number ?? index) * 10,
    is_active: true,
    updated_at: document.updated_at
  }));
}

/** DB 미적용·빈 테이블 시 정적 fallback */
export function getDefaultKnowledgeRows(): PartnerKnowledgeRow[] {
  const rows: PartnerKnowledgeRow[] = [];
  let order = 0;

  for (const section of PARTNER_POLICY_SECTIONS) {
    const parts: string[] = [];
    if (section.description) parts.push(section.description);
    if (section.bullets?.length) parts.push(section.bullets.join(" "));
    if (section.rows?.length) {
      for (const row of section.rows) {
        parts.push(Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(" · "));
      }
    }

    const categoryMap: Record<string, string> = {
      grades: "등급",
      benefits: "정책",
      training: "교육",
      poc: "운영기준",
      contract: "계약"
    };

    rows.push({
      id: `default-${section.id}`,
      category: categoryMap[section.id] ?? "기타",
      title: section.title,
      content: parts.join("\n"),
      keywords: `${section.title},${section.id},정책,기준`,
      source: "파트너 정책 (내장)",
      sort_order: order++,
      is_active: true,
      updated_at: null
    });
  }

  rows.push(
    {
      id: "default-faq-policy",
      category: "FAQ",
      title: "파트너 정책 개요",
      content:
        "오케스트로 파트너 정책은 등급 기준, 등급별 혜택, 교육 프로그램, PoC/기술지원, 계약·제출 서류로 구성됩니다.",
      keywords: "정책,개요,faq,가이드",
      source: "FAQ",
      sort_order: 100,
      is_active: true,
      updated_at: null
    },
    {
      id: "default-contract-contact",
      category: "운영기준",
      title: "계약 담당자 기준",
      content:
        "계약 담당자는 파트너사의 공식 계약·서류 창구입니다. partner_contacts에서 계약담당자로 지정된 담당자를 확인하세요.",
      keywords: "계약담당,담당자,기준",
      source: "운영 가이드",
      sort_order: 101,
      is_active: true,
      updated_at: null
    }
  );

  return rows;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

export function searchPartnerKnowledge(
  query: string,
  rows: PartnerKnowledgeRow[],
  limit = 5
): KnowledgeSearchHit[] {
  const activeRows = rows.filter((row) => row.is_active !== false);
  const haystack = query.toLowerCase();
  const tokens = tokenize(query);

  const scored = activeRows
    .map((row) => {
      let score = 0;
      const title = row.title.toLowerCase();
      const content = row.content.toLowerCase();
      const keywords = (row.keywords ?? "").toLowerCase();
      const category = row.category.toLowerCase();

      if (title.includes(haystack) || haystack.includes(title)) score += 120;
      if (keywords.split(",").some((kw) => kw.trim() && haystack.includes(kw.trim()))) score += 80;

      for (const token of tokens) {
        if (title.includes(token)) score += 40;
        if (keywords.includes(token)) score += 30;
        if (content.includes(token)) score += 15;
        if (category.includes(token)) score += 20;
      }

      if (/정책|policy/.test(haystack) && row.category === "정책") score += 25;
      if (/승급|등급|플래티넘|platinum|골드|gold|실버|silver|partner\s*type|파트너\s*유형|파트너\s*등급/.test(haystack) && row.category === "등급") {
        score += 80;
      }
      if (/승급|등급|platinum|gold|silver|partner\s*type/.test(haystack) && row.category !== "등급" && /영업|deal|등록/.test(`${title} ${content}`)) {
        score -= 70;
      }
      if (/영업기회|deal\s*registration|등록\s*절차/.test(haystack) && /영업|deal|등록/.test(`${title} ${content}`)) {
        score += 80;
      }
      if (/수익|profit|incentive|promotion|base\s*profit/.test(haystack) && /profit|수익|incentive|promotion/i.test(`${title} ${content} ${keywords}`)) {
        score += 45;
      }
      if (/교육|certification|인증|level\s*[12]|기술파트너/.test(haystack) && row.category === "교육") {
        score += 40;
      }
      if (/계약\s*절차|contract\s*process/.test(haystack) && row.category === "계약") {
        score += 45;
      }
      if (/kpi|목표|goal/.test(haystack) && row.category === "운영기준") {
        score += 40;
      }
      if (/교육|수강|참석/.test(haystack) && row.category === "교육") score += 35;
      if (/계약|서류|신청/.test(haystack) && row.category === "계약") score += 30;
      if (/담당자|계약담당/.test(haystack) && row.title.includes("담당자")) score += 40;
      if (/faq|가이드/.test(haystack) && row.category === "FAQ") score += 30;
      if (/슬라이드\s*\d+/.test(row.content) && /슬라이드|근거/.test(haystack)) score += 10;

      return { ...row, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return scored.slice(0, limit);
}
