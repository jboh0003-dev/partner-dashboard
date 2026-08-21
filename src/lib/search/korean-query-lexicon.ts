export type QueryConcept =
  | "phone"
  | "email"
  | "affiliation"
  | "person_profile"
  | "sales_contact"
  | "engineer_contact"
  | "training"
  | "pipeline"
  | "expected_win"
  | "asset"
  | "document";

const CONCEPT_SYNONYMS: Record<QueryConcept, string[]> = {
  phone: [
    "전화번호",
    "휴대폰번호",
    "휴대전화",
    "휴대폰",
    "연락처뭐야",
    "연락처",
    "연락",
    "폰번호",
    "직통",
    "모바일",
    "전화",
    "번호",
    "폰",
    "tel",
    "phone"
  ],
  email: [
    "이메일주소",
    "메일주소",
    "이메일",
    "메일",
    "e-mail",
    "email",
    "mail"
  ],
  affiliation: [
    "어디회사",
    "어느회사",
    "무슨회사",
    "회사어디",
    "어디소속",
    "어느파트너",
    "어느업체",
    "어디다녀",
    "사람들",
    "인력",
    "소속",
    "파트너사"
  ],
  person_profile: [
    "뭐하는사람",
    "무슨담당",
    "어떤사람",
    "담당뭐야",
    "어디회사사람",
    "누구지",
    "누구야",
    "누군데",
    "누구"
  ],
  sales_contact: [
    "영업담당자",
    "영업담당",
    "영업누구야",
    "영업누구",
    "계약담당",
    "세일즈",
    "영업",
    "sales"
  ],
  engineer_contact: ["기술담당", "기술인력", "엔지니어", "기술", "engineer", "se"],
  training: [
    "교육많이받은",
    "교육많이받",
    "교육받았",
    "교육받",
    "들었",
    "배웠",
    "수강",
    "참석",
    "이수",
    "수료",
    "교육"
  ],
  pipeline: ["파이프라인", "영업기회", "프로젝트", "딜", "사업"],
  expected_win: [
    "수주가능성",
    "수주예상",
    "수주가능",
    "수주할만",
    "수주기대",
    "가능성높은",
    "가능성있는",
    "될만한거",
    "될만한",
    "따낼만",
    "유력",
    "수주"
  ],
  asset: ["보유장비", "하드웨어", "리소스", "서버", "스펙", "사양", "장비", "hardware", "hw"],
  document: ["사업자등록증", "사업자등록", "회사소개서", "계약서", "신청서", "서류", "문서"]
};

const CONTACT_CONCEPTS = new Set<QueryConcept>([
  "phone",
  "email",
  "affiliation",
  "person_profile",
  "sales_contact",
  "engineer_contact"
]);

function uniqueLongest(values: string[]): string[] {
  return [...new Set(values.map((value) => value.toLowerCase().replace(/\s+/g, "")))].sort(
    (a, b) => b.length - a.length || a.localeCompare(b)
  );
}

const ALL_SYNONYMS = (Object.entries(CONCEPT_SYNONYMS) as Array<[QueryConcept, string[]]>).flatMap(
  ([concept, words]) => uniqueLongest(words).map((word) => ({ concept, word }))
).sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));

const PARTICLE_SUFFIXES = [
  "한테",
  "에게",
  "께",
  "으로",
  "에서",
  "이란",
  "라는",
  "으로",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "도",
  "만",
  "와",
  "과",
  "랑",
  "에"
].sort((a, b) => b.length - a.length);

export function compactKoreanQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/e-mail/g, "email")
    .replace(/[\s?!,.~'"“”‘’()[\]{}/\\]/g, "");
}

export function stripKoreanParticles(token: string): string {
  let value = token.trim();
  if (!value) return value;
  value = value.replace(/(님|씨)$/u, "");
  for (const suffix of PARTICLE_SUFFIXES) {
    if (value.endsWith(suffix) && value.length - suffix.length >= 2) {
      return value.slice(0, -suffix.length);
    }
  }
  return value;
}

export type KoreanQueryAnalysis = {
  concepts: QueryConcept[];
  remainder: string;
  remainderCompact: string;
};

export function analyzeKoreanQuery(query: string): KoreanQueryAnalysis {
  const compact = compactKoreanQuery(query);
  const used = new Set<QueryConcept>();
  let remainderCompact = compact;

  let changed = true;
  while (changed) {
    changed = false;
    for (const item of ALL_SYNONYMS) {
      if (item.word.length < 2 && item.concept !== "phone") continue;
      const idx = remainderCompact.indexOf(item.word);
      if (idx < 0) continue;
      used.add(item.concept);
      remainderCompact =
        remainderCompact.slice(0, idx) + remainderCompact.slice(idx + item.word.length);
      changed = true;
      break;
    }
  }

  const remainder = remainderCompact
    .replace(/[0-9+\-().]/g, " ")
    .trim();

  return {
    concepts: [...used],
    remainder,
    remainderCompact: remainderCompact.replace(/[0-9+\-().]/g, "")
  };
}

export function queryHasConcept(query: string, concept: QueryConcept): boolean {
  return analyzeKoreanQuery(query).concepts.includes(concept);
}

export function queryHasContactConcept(query: string): boolean {
  return analyzeKoreanQuery(query).concepts.some((concept) => CONTACT_CONCEPTS.has(concept));
}

export function requestedFieldsFromConcepts(concepts: QueryConcept[]): string[] {
  const fields: string[] = [];
  if (concepts.includes("phone")) fields.push("phone");
  if (concepts.includes("email")) fields.push("email");
  if (concepts.includes("affiliation")) fields.push("affiliation");
  if (concepts.includes("person_profile")) {
    fields.push("affiliation", "role", "department", "position", "phone", "email");
  }
  if (concepts.includes("sales_contact") || concepts.includes("engineer_contact")) {
    fields.push("role", "phone", "email");
  }
  return [...new Set(fields)];
}
