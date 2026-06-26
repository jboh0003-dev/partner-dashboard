export type CopyableRow = {
  id: string;
  companyName?: string | null;
  name?: string | null;
  role?: string | null;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  copyMeta?: Record<string, string>;
};

export type CopyFormat =
  | "emails"
  | "phones"
  | "name_emails"
  | "company_name_emails"
  | "selected_rows";

function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhoneKey(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function extractUniqueEmails(rows: CopyableRow[]): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const row of rows) {
    const email = row.email?.trim();
    if (!email) continue;
    const key = normalizeEmailKey(email);
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(email);
  }

  return emails;
}

export function extractUniquePhones(rows: CopyableRow[]): string[] {
  const seen = new Set<string>();
  const phones: string[] = [];

  for (const row of rows) {
    const phone = row.phone?.trim();
    if (!phone) continue;
    const key = normalizePhoneKey(phone);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    phones.push(phone);
  }

  return phones;
}

export function extractNameEmailEntries(rows: CopyableRow[]): string[] {
  const seen = new Set<string>();
  const entries: string[] = [];

  for (const row of rows) {
    const email = row.email?.trim();
    const name = row.name?.trim();
    if (!email || !name) continue;
    const key = normalizeEmailKey(email);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(`${name} <${email}>`);
  }

  return entries;
}

export function formatEmailsForOutlook(emails: string[]): string {
  return emails.join("; ");
}

export function formatPhonesNewline(phones: string[]): string {
  return phones.join("\n");
}

export function formatNameEmailsSemicolon(entries: string[]): string {
  return entries.join("; ");
}

export function formatCompanyNameEmailTsv(rows: CopyableRow[]): string {
  const seen = new Set<string>();
  const lines = ["회사명\t이름\t이메일"];

  for (const row of rows) {
    const company = row.companyName?.trim();
    const name = row.name?.trim();
    const email = row.email?.trim();
    if (!company || !name || !email) continue;
    const key = normalizeEmailKey(email);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${company}\t${name}\t${email}`);
  }

  return lines.join("\n");
}

export function formatSelectedRowsTsv(
  rows: CopyableRow[],
  headers: readonly string[],
  getValues: (row: CopyableRow) => string[]
): string {
  const lines = [headers.join("\t")];
  for (const row of rows) {
    lines.push(getValues(row).map((value) => value ?? "").join("\t"));
  }
  return lines.join("\n");
}

export function buildCopyPayload(
  format: CopyFormat,
  rows: CopyableRow[],
  selectedTsv?: {
    headers: readonly string[];
    getValues: (row: CopyableRow) => string[];
  }
): { text: string; count: number } | null {
  switch (format) {
    case "emails": {
      const emails = extractUniqueEmails(rows);
      if (emails.length === 0) return null;
      return { text: formatEmailsForOutlook(emails), count: emails.length };
    }
    case "phones": {
      const phones = extractUniquePhones(rows);
      if (phones.length === 0) return null;
      return { text: formatPhonesNewline(phones), count: phones.length };
    }
    case "name_emails": {
      const entries = extractNameEmailEntries(rows);
      if (entries.length === 0) return null;
      return { text: formatNameEmailsSemicolon(entries), count: entries.length };
    }
    case "company_name_emails": {
      const text = formatCompanyNameEmailTsv(rows);
      const count = Math.max(0, text.split("\n").length - 1);
      if (count === 0) return null;
      return { text, count };
    }
    case "selected_rows": {
      if (!selectedTsv || rows.length === 0) return null;
      return {
        text: formatSelectedRowsTsv(rows, selectedTsv.headers, selectedTsv.getValues),
        count: rows.length
      };
    }
    default:
      return null;
  }
}

export const COPY_EMPTY_MESSAGES: Record<CopyFormat, string> = {
  emails: "복사할 이메일이 없습니다.",
  phones: "복사할 연락처가 없습니다.",
  name_emails: "복사할 이름+이메일이 없습니다.",
  company_name_emails: "복사할 회사명+이름+이메일이 없습니다.",
  selected_rows: "복사할 행이 없습니다."
};

export const COPY_SUCCESS_LABELS: Record<CopyFormat, string> = {
  emails: "이메일",
  phones: "연락처",
  name_emails: "이름+이메일",
  company_name_emails: "회사명+이름+이메일",
  selected_rows: "선택 행"
};
