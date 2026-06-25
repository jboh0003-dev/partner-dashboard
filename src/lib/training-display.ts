export function formatTrainingYearMonth(
  year: number | null | undefined,
  month: number | null | undefined
): string {
  if (!year || !month) return "-";
  return `${year}년 ${month}월`;
}

export function formatTrainingDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).format(date);
}

export function formatAttendanceStatus(
  attended: boolean,
  status: string | null | undefined
): string {
  const trimmed = status?.trim();
  if (trimmed) return trimmed;
  return attended ? "참석" : "불참";
}

export function yearMonthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function parseYearMonthKey(value: string): { year: number; month: number } | null {
  const [yearRaw, monthRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function formatTrainingProduct(
  product: string | null | undefined,
  productName: string | null | undefined
): string {
  const value = product?.trim() || productName?.trim();
  return value || "-";
}

export function findLatestTrainingMonth(
  rows: Array<{ training_year: number | null; training_month: number | null }>
): string {
  let bestYear = 0;
  let bestMonth = 0;

  for (const row of rows) {
    if (!row.training_year || !row.training_month) continue;
    if (
      row.training_year > bestYear ||
      (row.training_year === bestYear && row.training_month > bestMonth)
    ) {
      bestYear = row.training_year;
      bestMonth = row.training_month;
    }
  }

  return bestYear && bestMonth ? formatTrainingYearMonth(bestYear, bestMonth) : "-";
}
