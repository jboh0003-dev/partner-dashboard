/** 백만원 → 억원 (1억 = 100백만) */
export function millionToEok(million: number | null | undefined): number | null {
  if (million == null || Number.isNaN(million)) return null;
  return Math.round((million / 100) * 10) / 10;
}

export function formatMillion(million: number | null | undefined): string {
  if (million == null || Number.isNaN(million)) return "-";
  return `${Math.round(million).toLocaleString("ko-KR")}백만원`;
}

export function formatEok(million: number | null | undefined): string {
  const eok = millionToEok(million);
  if (eok == null) return "-";
  return `${eok.toLocaleString("ko-KR")}억원`;
}

export function formatEokPrimary(million: number | null | undefined): string {
  const eok = millionToEok(million);
  if (eok == null) return "-";
  return `${eok.toLocaleString("ko-KR")}억`;
}

export function formatCount(count: number | null | undefined): string {
  if (count == null) return "-";
  return `${count.toLocaleString("ko-KR")}건`;
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return "-";
  const value = ratio <= 1 ? ratio * 100 : ratio;
  return `${Math.round(value * 10) / 10}%`;
}

export function parseSnapshotLabelToDate(label: string): string | null {
  const match = label.match(/(\d{6})/);
  if (!match) return null;
  const digits = match[1]!;
  const year = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `20${String(year).padStart(2, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseNumericCell(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value).replace(/,/g, "").trim();
  if (!text || text === "-") return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

export function isFlagO(value: unknown): boolean {
  if (value == null) return false;
  const text = String(value).trim().toUpperCase();
  return text === "O" || text === "○" || text === "Y" || text === "YES";
}

export function parseWinProbabilityValue(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return null;
  return Number(match[1]);
}

export function normalizeYearToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^FY\d{2}$/i.test(text)) return text.toUpperCase();
  const yearMatch = text.match(/(20\d{2})/);
  if (yearMatch) return `${yearMatch[1]}년`;
  return text;
}

export function isFy26(value: string | null | undefined): boolean {
  if (!value) return false;
  const text = String(value).trim().toUpperCase();
  return text === "FY26" || text === "2026" || text === "26";
}

export function isRegisteredYear2026(value: string | null | undefined): boolean {
  if (!value) return false;
  const text = String(value).trim();
  return text === "2026" || text === "2026년" || text.startsWith("2026");
}
