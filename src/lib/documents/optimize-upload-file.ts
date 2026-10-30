import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

export type OptimizedDocument = {
  file: File;
  originalBytes: number;
  savedBytes: number;
  method: "none" | "image" | "pdf" | "office";
};

const MAX_PROCESS_BYTES = 25 * 1024 * 1024;
const MIN_IMAGE_BYTES = 350 * 1024;

function replacementIfSmaller(
  original: File,
  candidate: File,
  method: OptimizedDocument["method"]
): OptimizedDocument {
  const smaller = candidate.size > 0 && candidate.size <= original.size * 0.96;
  return {
    file: smaller ? candidate : original,
    originalBytes: original.size,
    savedBytes: smaller ? original.size - candidate.size : 0,
    method: smaller ? method : "none"
  };
}

async function optimizeJpeg(file: File): Promise<File | null> {
  if (file.size < MIN_IMAGE_BYTES || typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82)
    );
    return blob ? new File([blob], file.name, { type: "image/jpeg", lastModified: file.lastModified }) : null;
  } finally {
    bitmap.close();
  }
}

async function optimizePdf(file: File): Promise<File | null> {
  const data = new Uint8Array(await file.arrayBuffer());
  // Re-saving a digitally signed PDF invalidates its signature: preserve it verbatim.
  const header = new TextDecoder("latin1").decode(data.subarray(0, Math.min(data.length, 1_048_576)));
  if (/\/ByteRange\s*\[|\/Type\s*\/Sig\b/.test(header)) return null;
  const pdf = await PDFDocument.load(data, { updateMetadata: false });
  const pageCount = pdf.getPageCount();
  const compacted = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
  if (pdf.getPageCount() !== pageCount) return null;
  return new File([new Uint8Array(compacted)], file.name, {
    type: "application/pdf",
    lastModified: file.lastModified
  });
}

async function optimizeOffice(file: File): Promise<File | null> {
  const zip = await JSZip.loadAsync(file);
  // Preserve package-level signatures and all Office XML/metadata.
  if (Object.keys(zip.files).some((name) => /(^|\/)\_xmlsignatures\//i.test(name))) return null;
  let changed = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !/^(?:ppt|word)\/media\/[^/]+\.jpe?g$/i.test(entry.name)) continue;
    const blob = await entry.async("blob");
    if (blob.size < MIN_IMAGE_BYTES) continue;
    const filePart = new File([blob], entry.name.split("/").pop() || "media.jpg", { type: "image/jpeg" });
    try {
      const reduced = await optimizeJpeg(filePart);
      if (!reduced || reduced.size >= blob.size * 0.96) continue;
      zip.file(entry.name, reduced, { binary: true, date: entry.date });
      changed += 1;
    } catch {
      // An individual image cannot be decoded: leave that entry unchanged.
    }
  }
  if (!changed) return null;
  const result = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
  return new File([result], file.name, { type: file.type, lastModified: file.lastModified });
}

// Only save a truly smaller, readable file. Already-compressed Excel files,
// signed PDFs and unsupported formats retain their originals.
export async function optimizePartnerUploadFile(file: File): Promise<OptimizedDocument> {
  const unchanged: OptimizedDocument = {
    file,
    originalBytes: file.size,
    savedBytes: 0,
    method: "none"
  };
  if (file.size < MIN_IMAGE_BYTES || file.size > MAX_PROCESS_BYTES) return unchanged;
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  try {
    if (extension === "jpg" || extension === "jpeg") {
      const candidate = await optimizeJpeg(file);
      return candidate ? replacementIfSmaller(file, candidate, "image") : unchanged;
    }
    if (extension === "pdf") {
      const candidate = await optimizePdf(file);
      return candidate ? replacementIfSmaller(file, candidate, "pdf") : unchanged;
    }
    if (extension === "docx" || extension === "pptx") {
      const candidate = await optimizeOffice(file);
      return candidate ? replacementIfSmaller(file, candidate, "office") : unchanged;
    }
  } catch {
    // Preserve the source on encrypted, malformed or otherwise unsupported documents.
  }
  return unchanged;
}
