/**
 * 자연어 질문 정규화.
 *
 * 검색 의도와 무관한 말투·조사·가벼운 오타를 정리하되 회사명 자체는 최대한 건드리지 않는다.
 * DB 검색 전에 한 번만 적용해, 규칙 기반 검색과 LLM planner가 같은 입력을 보도록 한다.
 */

const DOMAIN_TERMS = [
  "연락처",
  "담당자",
  "이메일",
  "파이프라인",
  "영업기회",
  "플래티넘",
  "사업자등록증",
  "사업자등록",
  "회사소개서",
  "신용평가",
  "계약서",
  "신청서",
  "리소스",
  "엔지니어"
] as const;

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/플레티넘|프래티넘|플라티넘/gi, "플래티넘"],
  [/파트너쉽/gi, "파트너십"],
  [/연락쳐|연럭처|연락처어?/gi, "연락처"],
  [/담장자|담당쟈|담당저/gi, "담당자"],
  [/이매일|이멜|메일주소/gi, "이메일"],
  [/파이프라임|파이프라인ㄴ|파이프라인느?/gi, "파이프라인"],
  [/영업기희|영업기회e/gi, "영업기회"],
  [/계악서/gi, "계약서"],
  [/신쳥서|신청써/gi, "신청서"],
  [/리소쓰/gi, "리소스"],
  [/엔지니어어?/gi, "엔지니어"],
  [/사업자\s*등록\s*증/gi, "사업자등록증"],
  [/회사\s*소개\s*서/gi, "회사소개서"],
  [/신용\s*평가\s*서?/gi, "신용평가"],
  [/담당하는\s*사람/gi, "담당자"],
  [/담당\s*하는\s*사람/gi, "담당자"],
  [/누가\s*담당(?:해|함|이야|인가|인지)?/gi, "담당자"],
  [/담당\s*누구(?:야|임|냐|지|였지)?/gi, "담당자 누구"],
  [/영업\s*누구(?:야|임|냐|지|였지)?/gi, "영업 담당자"],
  [/기술\s*누구(?:야|임|냐|지|였지)?/gi, "기술 담당자"],
  [/연락\s*(?:어떻게|어케|방법|할\s*수\s*있어)/gi, "연락처"],
  [/전화\s*번호|폰\s*번호|휴대폰\s*번호/gi, "연락처"],
  [/메일\s*(?:뭐야|뭐임|주소|줘|알려)/gi, "이메일"],
  [/올라가려면|올라가는\s*법|어떻게\s*올라가/gi, "승급 조건"],
  [/안\s*들었|안들었|안\s*들은|못\s*들었|미참석/gi, "미수강"],
  [/될\s*만한\s*(?:거|것|건)/gi, "수주 가능성 높은 영업기회"],
  [/따낼\s*만한\s*(?:거|것|건)/gi, "수주 가능성 높은 영업기회"],
  [/뭐\s*필요(?:해|함|하지|한데)?/gi, "필요 조건"],
  [/뭐가\s*필요(?:해|함|하지|한데)?/gi, "필요 조건"],
  [/어케/gi, "어떻게"],
  [/머야|뭐임|뭔데/gi, "뭐야"],
  [/누구임|누구냐|누군데|누구였지|누구더라/gi, "누구"],
  [/걔네|그쪽\s*회사|그\s*회사/gi, "그 파트너"]
];

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

/**
 * 검색 핵심어만 아주 보수적으로 오타 보정한다.
 * 회사명 오인식을 피하려고 3글자 미만 단어와 일반 명사는 보정하지 않는다.
 */
function normalizeDomainTypos(text: string): string {
  return text
    .split(/(\s+)/)
    .map((token) => {
      const value = token.trim();
      if (!value || value.length < 3 || !/[가-힣A-Za-z]/.test(value)) return token;

      const lower = value.toLowerCase();
      const candidates = DOMAIN_TERMS
        .map((term) => {
          const distance = levenshteinDistance(lower, term.toLowerCase());
          const maxDistance = term.length >= 6 ? 2 : 1;
          return { term, distance, maxDistance };
        })
        .filter(
          (item) =>
            Math.abs(value.length - item.term.length) <= item.maxDistance &&
            item.distance > 0 &&
            item.distance <= item.maxDistance
        )
        .sort((a, b) => a.distance - b.distance || b.term.length - a.term.length);

      if (candidates.length === 0) return token;
      if (candidates[1] && candidates[1].distance === candidates[0]!.distance) return token;
      return candidates[0]!.term;
    })
    .join("");
}

export function normalizeSearchQuery(query: string): string {
  let normalized = query
    .normalize("NFKC")
    .trim()
    .replace(/[“”‘’]/g, "\"")
    .replace(/[~…]+/g, " ")
    .replace(/(?:ㅋㅋ+|ㅎㅎ+|ㅠㅠ+|ㅜㅜ+)/g, " ")
    .replace(/\s+/g, " ");

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalizeDomainTypos(normalized)
    .replace(/\s+/g, " ")
    .replace(
      /(?:알려\s*줘|알려주세요|보여\s*줘|보여주세요|확인해\s*줘|확인해주세요|찾아\s*줘|찾아주세요|검색해\s*줘|검색해주세요|해\s*줘|해주세요|해\s*주세요|주세요|부탁해|부탁드립니다|좀|한번|한\s*번)\s*[?!.]*$/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  return normalized;
}

export function compactSearchQuery(query: string): string {
  return normalizeSearchQuery(query).replace(/\s+/g, "").toLowerCase();
}
