"use client";

import { X } from "lucide-react";

export function EventDocumentPreviewModal({
  open,
  url,
  title,
  extension,
  onClose
}: {
  open: boolean;
  url: string | null;
  title: string;
  extension: string;
  onClose: () => void;
}) {
  if (!open || !url) return null;

  const isPdf = extension === "pdf";
  const isImage = ["png", "jpg", "jpeg"].includes(extension);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-[50vh] flex-1 overflow-auto bg-slate-100 p-2">
          {isPdf ? (
            <iframe src={url} title={title} className="h-[75vh] w-full rounded-lg bg-white" />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={title} className="mx-auto max-h-[75vh] w-auto object-contain" />
          ) : (
            <p className="p-6 text-sm text-slate-600">미리보기를 지원하지 않는 형식입니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
