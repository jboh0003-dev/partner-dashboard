export type PartnerMatchStrategy = "company_name" | "business_number";

export type PartnerMatchInput = {
  company_name: string;
  business_number?: string | null;
};

export function normalizeMatchKey(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeBusinessNumber(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/[^0-9]/g, "");
  return normalized || null;
}

export function getExactCompanyNameKey(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function normalizeCompanyName(value?: string | null): string | null {
  if (!value) return null;

  const normalized = value
    .toLowerCase()
    .replace(/㈜/g, "")
    .replace(/주식회사/g, "")
    .replace(/\(주\)/g, "")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .trim();

  return normalized || null;
}

export function getPartnerMatchKey(
  row: PartnerMatchInput,
  strategy: PartnerMatchStrategy
): string | null {
  if (strategy === "company_name") {
    return normalizeCompanyName(row.company_name);
  }
  if (strategy === "business_number") {
    return normalizeBusinessNumber(row.business_number);
  }
  return null;
}

export function countMatchPreview(
  rows: PartnerMatchInput[],
  existingKeys: Set<string>,
  strategy: PartnerMatchStrategy = "company_name"
): { newCount: number; updateCount: number } {
  let newCount = 0;
  let updateCount = 0;

  for (const row of rows) {
    const key = getPartnerMatchKey(row, strategy);
    if (!key) continue;
    if (existingKeys.has(key)) updateCount += 1;
    else newCount += 1;
  }

  return { newCount, updateCount };
}
