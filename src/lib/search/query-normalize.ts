/** 질문 정규화 — 공백·조사·불필요 표현 제거 */
export function normalizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/\s+/g, " ")
    .replace(
      /알려\s*줘|알려주세요|보여\s*줘|보여주세요|확인해\s*줘|확인해주세요|찾아\s*줘|찾아주세요|해\s*줘|해주세요|해\s*주세요|주세요|부탁해|좀$/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function compactSearchQuery(query: string): string {
  return normalizeSearchQuery(query).replace(/\s+/g, "").toLowerCase();
}
