const PREVIEWABLE_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg"]);

export type PartnerEventDocumentRecord = {
  id: string;
  event_id: string;
  storage_path: string | null;
  original_file_name: string | null;
  display_name: string;
  file_extension: string | null;
};

export function resolveEventDocumentExtension(
  doc: Pick<PartnerEventDocumentRecord, "file_extension" | "original_file_name">
): string {
  const fromField = doc.file_extension?.trim().replace(/^\./, "").toLowerCase();
  if (fromField) return fromField;

  const filename = doc.original_file_name ?? "";
  const match = filename.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

export function getEventDocumentDownloadFileName(doc: PartnerEventDocumentRecord): string {
  const original = doc.original_file_name?.trim();
  if (original) return original;

  const ext = resolveEventDocumentExtension(doc);
  const base = doc.display_name.trim() || "행사자료";
  if (ext && !base.toLowerCase().endsWith(`.${ext}`)) {
    return `${base}.${ext}`;
  }
  return base;
}

export function isPreviewableEventDocument(
  doc: Pick<PartnerEventDocumentRecord, "file_extension" | "original_file_name">
): boolean {
  return PREVIEWABLE_EXTENSIONS.has(resolveEventDocumentExtension(doc));
}

