"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Loader2 } from "lucide-react";
import { EVENT_DOCUMENT_TYPE_LABEL } from "@/lib/events/event-document-types";
import {
  isPreviewableEventDocument,
  resolveEventDocumentExtension
} from "@/lib/events/event-document-access";
import { formatDate } from "@/lib/utils";
import type { PartnerEventDocument } from "@/types/event";
import { EventDocumentPreviewModal } from "@/components/events/event-document-preview-modal";

async function fetchSignedUrl(path: string): Promise<string> {
  const response = await fetch(`${path}?format=json`, {
    headers: { Accept: "application/json" }
  });
  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data.message ?? "파일 URL을 가져오지 못했습니다.");
  }
  return data.url as string;
}

export function EventDocumentActions({
  doc,
  compact = false,
  showMeta = true,
  onToggleRepresentative
}: {
  doc: PartnerEventDocument;
  compact?: boolean;
  showMeta?: boolean;
  onToggleRepresentative?: (docId: string, next: boolean) => void;
}) {
  const [loadingAction, setLoadingAction] = useState<"preview" | "download" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const previewable = isPreviewableEventDocument(doc);
  const ext = resolveEventDocumentExtension(doc);
  const isImage = ["png", "jpg", "jpeg"].includes(ext);

  async function handleDownload() {
    setLoadingAction("download");
    try {
      const url = await fetchSignedUrl(`/api/events/documents/${doc.id}/download`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "다운로드에 실패했습니다.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePreview() {
    if (!previewable) return;
    setLoadingAction("preview");
    try {
      const url = await fetchSignedUrl(`/api/events/documents/${doc.id}/preview`);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "미리보기에 실패했습니다.");
    } finally {
      setLoadingAction(null);
    }
  }

  const typeLabel = doc.document_type
    ? EVENT_DOCUMENT_TYPE_LABEL[doc.document_type as keyof typeof EVENT_DOCUMENT_TYPE_LABEL] ??
      doc.document_type
    : "자료";

  return (
    <>
      <div className={compact ? "space-y-2" : "rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                disabled={loadingAction !== null}
                className="break-all text-left font-semibold text-slate-900 hover:text-blue-700 disabled:opacity-50"
                title="클릭하여 다운로드"
              >
                {doc.display_name}
              </button>
              {doc.is_representative ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  대표
                </span>
              ) : null}
              {onToggleRepresentative ? (
                <button
                  type="button"
                  onClick={() => onToggleRepresentative(doc.id, !doc.is_representative)}
                  className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-white"
                >
                  {doc.is_representative ? "대표 해제" : "대표 지정"}
                </button>
              ) : null}
            </div>

            {showMeta ? (
              <dl className="mt-2 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                <div>
                  <dt className="inline">문서유형: </dt>
                  <dd className="inline text-slate-700">{typeLabel}</dd>
                </div>
                <div>
                  <dt className="inline">등록일: </dt>
                  <dd className="inline text-slate-700">{formatDate(doc.uploaded_at)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="inline">원본 파일명: </dt>
                  <dd className="inline break-all text-slate-700">
                    {doc.original_file_name ?? "-"}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <ActionButton
              label="미리보기"
              icon={<Eye size={14} />}
              disabled={!previewable || loadingAction !== null}
              loading={loadingAction === "preview"}
              title={
                previewable
                  ? "미리보기"
                  : "이 파일 형식은 다운로드 후 확인해 주세요."
              }
              onClick={handlePreview}
            />
            <ActionButton
              label="다운로드"
              icon={<Download size={14} />}
              disabled={loadingAction !== null}
              loading={loadingAction === "download"}
              onClick={handleDownload}
            />
          </div>
        </div>

        {isImage && previewable ? (
          <PhotoThumbnail docId={doc.id} alt={doc.display_name} onOpen={handlePreview} />
        ) : null}
      </div>

      <EventDocumentPreviewModal
        open={previewOpen}
        url={previewUrl}
        title={doc.display_name}
        extension={ext}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewUrl(null);
        }}
      />
    </>
  );
}

function ActionButton({
  label,
  icon,
  disabled,
  loading,
  title,
  onClick
}: {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

function PhotoThumbnail({
  docId,
  alt,
  onOpen
}: {
  docId: string;
  alt: string;
  onOpen: () => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSignedUrl(`/api/events/documents/${docId}/preview`)
      .then((url) => {
        if (!cancelled) setThumbUrl(url);
      })
      .catch(() => {
        /* ignore thumbnail load errors */
      });
    return () => {
      cancelled = true;
    };
  }, [docId]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-3 block overflow-hidden rounded-lg border border-slate-200 bg-white"
      title="크게 보기"
    >
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbUrl} alt={alt} className="max-h-40 w-auto object-contain" />
      ) : (
        <span className="block px-4 py-6 text-xs text-slate-500">사진 미리보기</span>
      )}
    </button>
  );
}

export function EventDocumentTableActions({ doc }: { doc: PartnerEventDocument }) {
  const [loadingAction, setLoadingAction] = useState<"preview" | "download" | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewable = isPreviewableEventDocument(doc);
  const ext = resolveEventDocumentExtension(doc);

  async function handleDownload() {
    setLoadingAction("download");
    try {
      const url = await fetchSignedUrl(`/api/events/documents/${doc.id}/download`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "다운로드에 실패했습니다.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function handlePreview() {
    if (!previewable) return;
    setLoadingAction("preview");
    try {
      const url = await fetchSignedUrl(`/api/events/documents/${doc.id}/preview`);
      setPreviewUrl(url);
      setPreviewOpen(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "미리보기에 실패했습니다.");
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <>
      <div className="flex gap-1">
        <ActionButton
          label="미리보기"
          icon={<Eye size={12} />}
          disabled={!previewable || loadingAction !== null}
          loading={loadingAction === "preview"}
          title={
            previewable ? "미리보기" : "이 파일 형식은 다운로드 후 확인해 주세요."
          }
          onClick={handlePreview}
        />
        <ActionButton
          label="다운로드"
          icon={<Download size={12} />}
          disabled={loadingAction !== null}
          loading={loadingAction === "download"}
          onClick={handleDownload}
        />
      </div>
      <EventDocumentPreviewModal
        open={previewOpen}
        url={previewUrl}
        title={doc.display_name}
        extension={ext}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewUrl(null);
        }}
      />
    </>
  );
}
