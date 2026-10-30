"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { UploadCloud } from "lucide-react";

type LegacyEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: LegacyEntry[]) => void, failure?: (error: DOMException) => void) => void;
  };
};

async function listEntryFiles(entry: LegacyEntry, parent = ""): Promise<File[]> {
  const relativePath = parent ? parent + "/" + entry.name : entry.name;
  if (entry.isFile && entry.file) {
    const file = await new Promise<File>((resolve, reject) => entry.file!(resolve, reject));
    // Preserve the folder path for upload flows that need to match partners by folder.
    if (parent) {
      try {
        Object.defineProperty(file, "webkitRelativePath", {
          configurable: true,
          value: relativePath
        });
      } catch {
        // Some browsers expose a non-configurable path. Use the original file.
      }
    }
    return [file];
  }
  if (!entry.isDirectory || !entry.createReader) return [];
  const reader = entry.createReader();
  const entries: LegacyEntry[] = [];
  // readEntries returns at most 100 entries per call on Chromium; loop until empty.
  for (;;) {
    const page = await new Promise<LegacyEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
    );
    if (!page.length) break;
    entries.push(...page);
    if (entries.length > 3000) throw new Error("한 번에 최대 3,000개 파일까지 선택할 수 있습니다.");
  }
  const groups = await Promise.all(entries.map((child) => listEntryFiles(child, relativePath)));
  return groups.flat();
}

export async function filesFromDrop(dataTransfer: DataTransfer, allowFolders = false): Promise<File[]> {
  const items = Array.from(dataTransfer.items || []).filter((item) => item.kind === "file");
  const entries = items
    .map((item) => (item as DataTransferItem & {
      webkitGetAsEntry?: () => LegacyEntry | null;
    }).webkitGetAsEntry?.() ?? null);
  if (entries.some(Boolean)) {
    if (!allowFolders && entries.some((entry) => entry?.isDirectory)) {
      throw new Error("이 업로드는 파일만 지원합니다. 폴더 대신 파일을 선택해 주세요.");
    }
    const groups = await Promise.all(entries
      .filter((entry) => entry !== null)
      .map((entry) => listEntryFiles(entry as LegacyEntry)));
    const files = groups.flat();
    if (files.length) return files;
  }
  return Array.from(dataTransfer.files || []);
}

function acceptedFile(file: File, accept?: string) {
  if (!accept) return true;
  const accepted = accept.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
  const fileName = file.name.toLowerCase();
  const mime = file.type.toLowerCase();
  return accepted.some((part) =>
    part === "*/*" ||
    (part.startsWith(".") && fileName.endsWith(part)) ||
    (part.endsWith("/*") && mime.startsWith(part.slice(0, -1))) ||
    (mime && mime === part)
  );
}

export function UploadDropArea({
  children,
  onFiles,
  onError,
  accept,
  multiple = false,
  allowFolders = false,
  disabled = false,
  className = ""
}: {
  children: ReactNode;
  onFiles: (files: File[]) => void | Promise<void>;
  onError?: (message: string) => void;
  accept?: string;
  multiple?: boolean;
  allowFolders?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (disabled || !Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    event.stopPropagation();
    depth.current += 1;
    setDragging(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setDragging(false);
  }

  async function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    depth.current = 0;
    setDragging(false);
    if (disabled) return;
    try {
      const files = await filesFromDrop(event.dataTransfer, allowFolders);
      if (files.length === 0) throw new Error("드롭한 항목에 업로드할 파일이 없습니다.");
      if (!multiple && files.length !== 1) {
        throw new Error("이 업로드는 파일 1개만 지원합니다.");
      }
      const invalid = files.find((file) => !acceptedFile(file, accept));
      if (invalid) {
        throw new Error("지원하지 않는 파일 형식입니다: " + invalid.name);
      }
      await onFiles(files);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "파일을 읽지 못했습니다.");
    }
  }

  return (
    <div
      className={"relative " + className}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(event) => { void onDrop(event); }}
    >
      {children}
      {dragging && !disabled ? (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-blue-500 bg-blue-50/95 text-center shadow-inner">
          <UploadCloud size={28} className="text-blue-600" />
          <span className="text-sm font-bold text-blue-800">여기에 놓아 업로드할 파일을 선택하세요</span>
        </div>
      ) : null}
    </div>
  );
}
