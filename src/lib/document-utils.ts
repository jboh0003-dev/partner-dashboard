/** 문서 다운로드/미리보기 URL — file_url 우선, 없으면 file_path */
export function resolveDocumentHref(doc: {
  file_url: string | null;
  file_path: string | null;
}): string | null {
  if (doc.file_url?.trim()) return doc.file_url.trim();
  if (doc.file_path?.trim()) return doc.file_path.trim();
  return null;
}
