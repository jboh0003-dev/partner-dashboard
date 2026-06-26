import type { PolicyCategoryKey } from "@/lib/policy/constants";

const RULES: Array<{ category: PolicyCategoryKey; patterns: RegExp[] }> = [
  {
    category: "Overview",
    patterns: [/okestro\s*partnership/i, /overview/i, /파트너\s*정책/i, /partner\s*program/i]
  },
  {
    category: "Partner Type",
    patterns: [/partner\s*type/i, /var\b/i, /platinum/i, /gold/i, /silver/i, /strategic/i, /파트너\s*등급/i, /파트너\s*유형/i]
  },
  {
    category: "Profit Program",
    patterns: [/profit\s*program/i, /base\s*profit/i, /promotion/i, /target\s*incentive/i, /수익/i, /인센티브/i]
  },
  {
    category: "Technical Program",
    patterns: [/technical/i, /certification/i, /level\s*[12]/i, /기술파트너/i, /기술\s*자격/i, /poc/i]
  },
  {
    category: "Support Program",
    patterns: [/support\s*fee/i, /ma\s*\/?\s*care/i, /academy/i, /seminar/i, /cx\s*arena/i, /지원/i, /유지보수/i]
  },
  {
    category: "Contract Process",
    patterns: [/contract/i, /계약\s*절차/i, /파트너\s*계약/i, /인증서/i]
  },
  {
    category: "Deal Registration",
    patterns: [/deal\s*registration/i, /영업기회/i, /등록\s*절차/i]
  },
  {
    category: "KPI / Goal",
    patterns: [/\bkpi\b/i, /goal/i, /목표/i, /2026년\s*파트너/i]
  },
  {
    category: "Appendix",
    patterns: [/appendix/i, /부록/i, /참고/i]
  }
];

export function categorizePolicySlide(title: string, body: string): PolicyCategoryKey {
  const haystack = `${title}\n${body}`.slice(0, 2000);
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return rule.category;
    }
  }
  return "기타";
}

export function extractKeywords(title: string, body: string): string[] {
  const text = `${title} ${body}`;
  const tokens = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(token);
    if (keywords.length >= 12) break;
  }
  return keywords;
}
