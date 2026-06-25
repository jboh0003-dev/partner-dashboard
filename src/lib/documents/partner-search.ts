import { normalizeCompanyName } from "@/lib/partner-match";
import { PARTNER_NAME_ALIASES } from "@/lib/search/company-terms";

export type PartnerSearchOption = {
  id: string;
  company_name: string;
  external_no: string | null;
  searchText: string;
};

function extractParentheticalAliases(companyName: string): string[] {
  const aliases: string[] = [];
  const match = companyName.match(/\(([^)]+)\)/);
  if (!match?.[1]) return aliases;

  for (const part of match[1].split(/[,/|·]/)) {
    const alias = part.trim();
    if (alias.length >= 2) aliases.push(alias);
  }
  return aliases;
}

export function buildPartnerSearchOptions(
  partners: Array<{ id: string; company_name: string; external_no?: string | null }>
): PartnerSearchOption[] {
  return partners.map((partner) => {
    const aliases = extractParentheticalAliases(partner.company_name);
    const primary = partner.company_name.replace(/\([^)]+\)/, "").trim();
    const tokens = [
      partner.company_name,
      primary,
      ...aliases,
      partner.external_no ?? "",
      normalizeCompanyName(partner.company_name),
      normalizeCompanyName(primary),
      ...aliases.map((alias) => normalizeCompanyName(alias))
    ];

    for (const [aliasKey, aliasTarget] of Object.entries(PARTNER_NAME_ALIASES)) {
      if (aliasTarget === normalizeCompanyName(partner.company_name)) {
        tokens.push(aliasKey);
      }
    }

    return {
      id: partner.id,
      company_name: partner.company_name,
      external_no: partner.external_no ?? null,
      searchText: tokens
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim().toLowerCase())
        .join(" ")
    };
  });
}

export function filterPartnerSearchOptions(
  options: PartnerSearchOption[],
  query: string,
  limit = 30
): PartnerSearchOption[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return options.slice(0, limit);

  const normalizedQuery = normalizeCompanyName(trimmed);

  return options
    .map((option) => {
      let score = 0;
      const nameLower = option.company_name.toLowerCase();

      if (nameLower === trimmed) score += 200;
      if (nameLower.startsWith(trimmed)) score += 120;
      if (nameLower.includes(trimmed)) score += 80;
      if (option.searchText.includes(trimmed)) score += 60;
      if (normalizedQuery && option.searchText.includes(normalizedQuery)) score += 50;

      for (const alias of extractParentheticalAliases(option.company_name)) {
        if (alias.toLowerCase() === trimmed) score += 150;
        if (alias.toLowerCase().includes(trimmed)) score += 70;
      }

      return { option, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.option.company_name.localeCompare(right.option.company_name, "ko");
    })
    .slice(0, limit)
    .map((entry) => entry.option);
}

export function findPartnerOptionById(
  options: PartnerSearchOption[],
  partnerId: string | null | undefined
): PartnerSearchOption | null {
  if (!partnerId) return null;
  return options.find((option) => option.id === partnerId) ?? null;
}
