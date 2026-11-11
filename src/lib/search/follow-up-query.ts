type HistoryMessage = { role: "user" | "assistant"; content: string };

const companyReference = /(?:그\s*회사|그\s*파트너(?:사)?|해당\s*회사|해당\s*파트너(?:사)?|그쪽|거기)/;
export function needsPartnerReference(query: string): boolean {
  return companyReference.test(query) || /등급/.test(query);
}

export function isPartnerGradeQuestion(query: string): boolean {
  return /등급/.test(query) && !/(정책|승급|기준|조건|혜택|요건|차이|종류|체계|유지|변경)/.test(query);
}

export function resolvePartnerFollowUpQuery(query: string, history: HistoryMessage[], names: string[]): string {
  const compact = (value: string) => value.replace(/\(주\)|주식회사|[\s.,?!]/g, "").toLowerCase();
  const matches = (text: string) => {
    const value = compact(text);
    const found = names.filter(name => compact(name).length >= 2 && value.includes(compact(name)));
    // A short company name can be contained in a longer registered name.
    return found.filter(name => !found.some(other => other !== name && compact(other).includes(compact(name))));
  };
  let found = matches(query);
  if (!found.length && companyReference.test(query)) {
    for (const message of [...history].reverse()) {
      if (message.role !== "user") continue;
      found = matches(message.content);
      if (found.length) break;
    }
  }
  // Do not silently select a company from a comparison or list question.
  if (found.length !== 1) return query;
  const company = found[0];
  if (isPartnerGradeQuestion(query)) return `${company} 기본 정보`;
  return query.replace(companyReference, company);
}
