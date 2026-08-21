import { stripPhoneDigits } from "@/lib/contacts/phone-normalize";
import {
  analyzeKoreanQuery,
  queryHasConcept,
  queryHasContactConcept,
  stripKoreanParticles
} from "@/lib/search/korean-query-lexicon";

export type DetectedQueryEntities = {
  emails: string[];
  phones: string[];
  businessNumbers: string[];
  projectCodes: string[];
  surnamePrefix: string | null;
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PROJECT_CODE_RE = /\bOP\s*-?\s*\d{2}\s*-?\s*\d{4}\b/gi;
const BIZ_NO_RE = /\b\d{3}-?\d{2}-?\d{5}\b/g;

export function detectQueryEntities(query: string): DetectedQueryEntities {
  const emails = [...(query.match(EMAIL_RE) ?? [])].map((value) => value.toLowerCase().trim());
  const projectCodes = [...(query.match(PROJECT_CODE_RE) ?? [])].map((value) =>
    value.replace(/\s+/g, "").replace(/op/i, "OP").toUpperCase().replace(/^OP(\d{2})(\d{4})$/, "OP-$1-$2").replace(/^OP-?(\d{2})-?(\d{4})$/, "OP-$1-$2")
  );
  const businessNumbers = [...(query.match(BIZ_NO_RE) ?? [])].filter((value) => !value.includes("@"));

  const digits = stripPhoneDigits(query);
  const phones: string[] = [];
  if (digits.length >= 4 && digits.length <= 11 && !query.includes("@")) {
    phones.push(digits.startsWith("10") && digits.length === 10 ? `0${digits}` : digits);
  }

  const surname = query.match(/([가-힣])\s*씨/);

  return {
    emails: [...new Set(emails)],
    phones: [...new Set(phones)],
    businessNumbers: [...new Set(businessNumbers)],
    projectCodes: [...new Set(projectCodes)],
    surnamePrefix: surname?.[1] ?? null
  };
}

export function leftoverQueryTokens(query: string): string[] {
  const withoutIds = query
    .replace(EMAIL_RE, " ")
    .replace(PROJECT_CODE_RE, " ")
    .replace(BIZ_NO_RE, " ");
  const analysis = analyzeKoreanQuery(withoutIds);
  const spaced = withoutIds
    .replace(/[0-9+\-().?!,.]/g, " ")
    .split(/\s+/)
    .map((token) => {
      const stripped = stripKoreanParticles(token);
      const inner = analyzeKoreanQuery(stripped);
      return stripKoreanParticles(inner.remainderCompact || stripped);
    })
    .filter((token) => token.length >= 2 && !["았어", "었어", "거야", "거", "것", "있음", "있어", "있나"].includes(token));

  const compact = stripKoreanParticles(analysis.remainderCompact)
    .replace(/(았어|었어|거야|인가|인지|좀)$/u, "");
  const tokens = spaced.length > 0 ? spaced : compact ? [compact] : [];
  const filtered = tokens.filter((token) => {
    const analysisToken = analyzeKoreanQuery(token);
    return analysisToken.remainderCompact.length >= 2;
  });
  if (filtered.length > 0) return [...new Set(filtered)];
  return compact.length >= 2 ? [compact] : [];
}

export function queryHasContactHint(query: string): boolean {
  return queryHasContactConcept(query);
}

export function queryHasTrainingHint(query: string): boolean {
  return queryHasConcept(query, "training");
}

export function queryHasPipelineHint(query: string): boolean {
  return queryHasConcept(query, "pipeline") || queryHasConcept(query, "expected_win");
}

export function queryHasSalesRoleHint(query: string): boolean {
  return queryHasConcept(query, "sales_contact");
}

export function queryHasEngineerRoleHint(query: string): boolean {
  return queryHasConcept(query, "engineer_contact");
}

export function queryHasExpectedWinHint(query: string): boolean {
  return queryHasConcept(query, "expected_win");
}
