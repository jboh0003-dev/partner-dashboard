import type { PolicyCategoryKey } from "@/lib/policy/constants";

const RULES: Array<{ category: PolicyCategoryKey; patterns: RegExp[] }> = [
  {
    category: "Overview",
    patterns: [/okestro\s*partnership/i, /\boverview\b/i, /파트너\s*정책/i, /partner\s*program/i, /contents/i]
  },
  {
    category: "Partner Type",
    patterns: [
      /partner\s*type/i,
      /\bvar\b/i,
      /\bplatinum\b/i,
      /\bgold\b/i,
      /\bsilver\b/i,
      /\bservice\b/i,
      /파트너\s*등급/i,
      /파트너\s*유형/i,
      /역할/i,
      /mdf/i
    ]
  },
  {
    category: "Profit Program",
    patterns: [
      /profit\s*program/i,
      /base\s*profit/i,
      /\bpromotion\b/i,
      /target\s*incentive/i,
      /technical\s*support\s*fee/i,
      /수익/i,
      /인센티브/i,
      /케어팩|care\s*pack/i
    ]
  },
  {
    category: "Technical Program",
    patterns: [
      /technical\s*certification/i,
      /technical\s*program/i,
      /level\s*1/i,
      /level\s*2/i,
      /기술파트너/i,
      /기술\s*자격/i,
      /\bpoc\b/i,
      /구축/i,
      /마이그레이션/i,
      /\bma\b/i,
      /care\s*pack/i
    ]
  },
  {
    category: "Support Program",
    patterns: [
      /\bacademy\b/i,
      /customer\s*seminar/i,
      /cx\s*arena/i,
      /partner\s*certification/i,
      /지원\s*프로그램/i,
      /유지보수\s*정책/i
    ]
  },
  {
    category: "Contract Process",
    patterns: [
      /contract\s*process/i,
      /파트너\s*계약\s*절차/i,
      /계약\s*절차/i,
      /신청\s*서류/i,
      /계약\s*서류/i,
      /계약\s*제한/i,
      /사업자등록/i,
      /회사소개서/i,
      /통장사본/i,
      /신용평가/i
    ]
  },
  {
    category: "Deal Registration",
    patterns: [
      /deal\s*registration/i,
      /deal\s*report/i,
      /영업기회/i,
      /영업우선권/i,
      /conflict/i,
      /등록\s*절차/i
    ]
  },
  {
    category: "KPI / Goal",
    patterns: [/\bkpi\b/i, /\bgoal\b/i, /목표/i, /2026년\s*파트너/i, /파트너\s*매출/i, /사업기회/i]
  },
  {
    category: "Appendix",
    patterns: [/appendix/i, /부록/i, /참고/i]
  }
];

export function categorizePolicySlide(title: string, body: string): PolicyCategoryKey {
  const haystack = `${title}\n${body}`.slice(0, 4000);

  if (/구분[\s\S]{0,80}platinum[\s\S]{0,80}gold[\s\S]{0,80}silver[\s\S]{0,80}service/i.test(haystack)) {
    return "Partner Type";
  }

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
