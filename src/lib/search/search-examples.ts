/** Partner AI 검색 예시 질문 */
export const OKE_EXAMPLE_QUERIES = [
  "전영봉 누구지?",
  "연락처 뭐야 전영봉",
  "인터루바인 영업 누구야?",
  "수주 가능성 높은 곳",
  "교육 많이 받은 데?",
  "최근 계약 파트너",
  "강현우 어디 회사 사람이야?",
  "OP-25-0844"
] as const;

export const PAGE_EXAMPLE_QUESTIONS = OKE_EXAMPLE_QUERIES;

export const OKE_QUICK_CHIPS = [
  "플래티넘 파트너 목록",
  "파트너 전체 영업기회",
  "수주 예상 프로젝트",
  "최근 계약 파트너"
] as const;

export const EXAMPLE_QUESTIONS = OKE_EXAMPLE_QUERIES;
export { OKE_GREETING, OKE_NAME, OKE_SUBTITLE } from "@/lib/search/oke-branding";
