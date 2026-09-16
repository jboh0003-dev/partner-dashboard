import { normalizeCompanyName } from "@/lib/partner-match";
import { stripNonPartnerTerms } from "@/lib/search/company-terms";
import { normalizeSearchQuery } from "@/lib/search/query-normalize";

type PartnerLike = {
  id: string;
  company_name: string;
};

const GENERIC_QUERY_TOKENS = new Set([
  "파트너",
  "파트너사",
  "회사",
  "업체",
  "담당자",
  "담당",
  "연락처",
  "전화",
  "번호",
  "이메일",
  "메일",
  "영업",
  "기술",
  "엔지니어",
  "교육",
  "수강",
  "이수",
  "참석",
  "장비",
  "리소스",
  "서버",
  "문서",
  "서류",
  "계약서",
  "신청서",
  "사업자등록증",
  "회사소개서",
  "신용평가",
  "실적",
  "파이프라인",
  "영업기회",
  "프로젝트",
  "정보",
  "현황",
  "목록",
  "누구",
  "누구야",
  "뭐야",
  "뭔지",
  "어디",
  "어느",
  "알려",
  "보여",
  "확인",
  "찾아",
  "검색",
  "필요",
  "조건",
  "관련",
  "대상",
  "그",
  "그쪽"
]);

const PARTICLES = [
  "에서",
  "한테",
  "에게",
  "으로",
  "이랑",
  "랑",
  "하고",
  "의",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "와",
  "과",
  "도",
  "만",
  "에"
].sort((a, b) => b.length - a.length);

function stripParticle(token: string): string {
  let value = token.trim();
  for (const particle of PARTICLES) {
    if (value.endsWith(particle) && value.length - particle.length >= 2) {
      value = value.slice(0, -particle.length);
      break;
    }
  }
  return value;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j]!;
  }
  return previous[b.length]!;
}

function fuzzyPartnerToken(
  query: string,
  partners: PartnerLike[]
): string | null {
  const tokens = query
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map(stripParticle)
    .filter((token) => token.length >= 2)
    .filter((token) => !GENERIC_QUERY_TOKENS.has(token.toLowerCase()));

  const phrases = new Set<string>();
  for (let i = 0; i < tokens.length; i += 1) {
    phrases.add(tokens[i]!);
    if (tokens[i + 1]) phrases.add(`${tokens[i]}${tokens[i + 1]}`);
  }

  const scored: Array<{ queryPart: string; partnerName: string; score: number }> = [];
  for (const phrase of phrases) {
    const normalizedPhrase = normalizeCompanyName(phrase);
    if (!normalizedPhrase || normalizedPhrase.length < 3) continue;

    for (const partner of partners) {
      const normalizedPartner = normalizeCompanyName(partner.company_name);
      if (!normalizedPartner) continue;

      if (
        normalizedPartner.includes(normalizedPhrase) ||
        normalizedPhrase.includes(normalizedPartner)
      ) {
        scored.push({ queryPart: phrase, partnerName: partner.company_name, score: 0 });
        continue;
      }

      const maxLength = Math.max(normalizedPhrase.length, normalizedPartner.length);
      const distance = levenshteinDistance(normalizedPhrase, normalizedPartner);
      const allowed = maxLength >= 7 ? 2 : 1;
      if (distance <= allowed && distance / maxLength <= 0.3) {
        scored.push({ queryPart: phrase, partnerName: partner.company_name, score: distance });
      }
    }
  }

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      b.queryPart.length - a.queryPart.length ||
      a.partnerName.localeCompare(b.partnerName, "ko-KR")
  );
  if (scored.length === 0) return null;

  const best = scored[0]!;
  const tied = scored.find(
    (item, index) =>
      index > 0 && item.score === best.score && item.partnerName !== best.partnerName
  );
  if (tied) return null;

  // 여기서 실제 DB 회사명으로 보정하면 뒤 단계의 회사명 resolver가 확정 매칭할 수 있다.
  return best.partnerName;
}

/**
 * 질문문에서 파트너 회사명 후보를 추출한다.
 * 정확 표기뿐 아니라 "회사명 + 자연어"와 1~2글자 수준의 회사명 오타도 보수적으로 보정한다.
 */
export function extractCompanyCandidateFromQuery(
  query: string,
  partners: PartnerLike[],
  strippedFallback: string | null
): string | null {
  const normalizedInput = normalizeSearchQuery(query) || query.trim();
  const sanitizedQuery = stripNonPartnerTerms(normalizedInput);
  if (!sanitizedQuery) return null;

  const rawLower = sanitizedQuery.toLowerCase();
  const normalizedQuery = normalizeCompanyName(sanitizedQuery) ?? "";

  const matches: Array<{ name: string; score: number }> = [];

  for (const partner of partners) {
    const name = partner.company_name.trim();
    if (!name) continue;

    const normalizedName = normalizeCompanyName(name);
    if (!normalizedName) continue;

    if (rawLower.includes(name.toLowerCase())) {
      matches.push({ name, score: 0 });
      continue;
    }

    if (normalizedQuery.includes(normalizedName) && normalizedName.length >= 3) {
      matches.push({ name, score: 1 });
    }
  }

  if (matches.length > 0) {
    matches.sort((a, b) => a.score - b.score || b.name.length - a.name.length);
    return matches[0]!.name;
  }

  const fuzzy = fuzzyPartnerToken(sanitizedQuery, partners);
  if (fuzzy) return fuzzy;

  const fallback = stripNonPartnerTerms(
    normalizeSearchQuery(strippedFallback?.trim() ?? "")
  );
  if (fallback.length >= 3) return fuzzyPartnerToken(fallback, partners) ?? fallback;

  return null;
}
