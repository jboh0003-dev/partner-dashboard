"use client";

import { useState } from "react";
import {
  getDocumentDisplayFileName,
  isPreviewableDocument,
  type DocumentDisplaySource
} from "@/lib/documents/display";

type DocumentRowActionsProps = {
  documentId: string;
  document: DocumentDisplaySource;
  showFileNameLink?: boolean;
};

export async function downloadPartnerDocumentFile(
  documentId: string,
  fallbackName: string
): Promise<void> {
  const response = await fetch(`/api/partners/documents/${documentId}/download`);
  if (!response.ok) {
    const json = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(json?.message ?? "다운로드에 실패했습니다.");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
  const filename = filenameMatch?.[1]
    ? decodeURIComponent(filenameMatch[1])
    : filenameMatch?.[2] ?? fallbackName;

  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DocumentFileNameLink({
  documentId,
  document
}: {
  documentId: string;
  document: DocumentDisplaySource;
}) {
  const [downloading, setDownloading] = useState(false);
  const label = getDocumentDisplayFileName(document);

  async function handleDownload() {
    try {
      setDownloading(true);
      await downloadPartnerDocumentFile(documentId, label);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "다운로드에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownload()}
      disabled={downloading}
      className="text-left text-sm font-medium text-okestro-600 hover:text-okestro-700 hover:underline disabled:opacity-50"
      title={label}
    >
      {downloading ? "다운로드 중..." : label}
    </button>
  );
}

export function DocumentPreviewButton({
  documentId,
  document
}: {
  documentId: string;
  document: DocumentDisplaySource;
}) {
  const previewable = isPreviewableDocument(document);

  function handlePreview() {
    if (!previewable) {
      window.alert("미리보기를 지원하지 않는 파일 형식입니다. 다운로드 후 확인해 주세요.");
      return;
    }

    window.open(
      `/api/partners/documents/${documentId}/preview`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <button
      type="button"
      onClick={handlePreview}
      disabled={!previewable}
      title={
        previewable
          ? "새 탭에서 미리보기"
          : "미리보기를 지원하지 않는 파일 형식입니다."
      }
      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      미리보기
    </button>
  );
}

export function DocumentDownloadButton({
  documentId,
  document
}: {
  documentId: string;
  document: DocumentDisplaySource;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    try {
      setDownloading(true);
      await downloadPartnerDocumentFile(documentId, getDocumentDisplayFileName(document));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "다운로드에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleDownload()}
      disabled={downloading}
      className="ui-btn-secondary rounded-md px-2.5 py-1 text-xs disabled:opacity-50"
    >
      {downloading ? "준비 중..." : "다운로드"}
    </button>
  );
}

export function DocumentRowActions({
  documentId,
  document,
  showFileNameLink = false
}: DocumentRowActionsProps) {
  return (
    <div className="flex flex-col gap-2">
      {showFileNameLink ? (
        <DocumentFileNameLink documentId={documentId} document={document} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <DocumentPreviewButton documentId={documentId} document={document} />
        <DocumentDownloadButton documentId={documentId} document={document} />
      </div>
    </div>
  );
}
