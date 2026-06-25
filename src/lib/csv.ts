export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvCell>;

const QUOTE_TARGET = /[",\r\n]/;

function escapeCell(value: string): string {
  if (QUOTE_TARGET.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normalize(raw: CsvCell): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "boolean") return raw ? "O" : "";
  if (typeof raw === "number") return Number.isFinite(raw) ? String(raw) : "";
  return raw;
}

export function buildCsv(rows: CsvRow[]): string {
  if (rows.length === 0) {
    return "\uFEFF";
  }

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map((header) => escapeCell(header)).join(",");
  const bodyLines = rows.map((row) =>
    headers.map((header) => escapeCell(normalize(row[header]))).join(",")
  );

  return `\uFEFF${[headerLine, ...bodyLines].join("\r\n")}`;
}

export function downloadCsv(filename: string, csv: string): void {
  if (typeof window === "undefined") return;

  const safeName = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function todayStamp(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
