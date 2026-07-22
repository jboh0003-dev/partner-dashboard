/** 사업자등록번호 화면 표시: 000-00-00000 */
export function formatBusinessNumberDisplay(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 10) return (value ?? "").trim();
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/**
 * 계약서용 회사명 표기 정규화.
 * - "주식회사" 접두: 뒤에 공백 1칸
 * - "(주)" / "㈜" 접두: 회사명과 붙여쓰기
 * - 상호 내부 공백은 유지
 */
export function normalizeContractCompanyName(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (raw.startsWith("주식회사")) {
    const rest = raw.slice("주식회사".length).replace(/^\s+/, "");
    return rest ? `주식회사 ${rest}` : "주식회사";
  }

  if (raw.startsWith("(주)")) {
    const rest = raw.slice("(주)".length).replace(/^\s+/, "");
    return rest ? `(주)${rest}` : "(주)";
  }

  if (raw.startsWith("㈜")) {
    const rest = raw.slice("㈜".length).replace(/^\s+/, "");
    return rest ? `㈜${rest}` : "㈜";
  }

  return raw;
}

/** 계약서용 한글 날짜: 2026년 06월 30일 */
export function formatContractKoreanDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) throw new Error(`계약일 형식이 올바르지 않습니다: ${isoDate}`);
  const [, y, m, d] = match;
  return `${y}년 ${m}월 ${d}일`;
}

/** 계약 종료일 = 시작일 + 1년 - 1일 */
export function computeContractEndDate(startIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso.trim());
  if (!match) throw new Error(`계약일 형식이 올바르지 않습니다: ${startIso}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(start.getTime())) throw new Error(`계약일을 해석할 수 없습니다: ${startIso}`);

  const end = new Date(Date.UTC(year + 1, month - 1, day));
  end.setUTCDate(end.getUTCDate() - 1);

  const ey = end.getUTCFullYear();
  const em = String(end.getUTCMonth() + 1).padStart(2, "0");
  const ed = String(end.getUTCDate()).padStart(2, "0");
  return `${ey}-${em}-${ed}`;
}

export function formatContractFilenameDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

export type PartnerContractGrade = "silver" | "gold" | "platinum";

export const PARTNER_CONTRACT_GRADE_LABEL: Record<PartnerContractGrade, string> = {
  silver: "실버",
  gold: "골드",
  platinum: "플래티넘"
};

export function parsePartnerContractGrade(value: string | null | undefined): PartnerContractGrade | null {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "silver" || raw === "실버") return "silver";
  if (raw === "gold" || raw === "골드") return "gold";
  if (raw === "platinum" || raw === "플래티넘" || raw === "플래티늄") return "platinum";
  return null;
}
