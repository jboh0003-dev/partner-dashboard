"use client";

import { useMemo, useState, useTransition } from "react";
import {
  EVENT_DOCUMENT_TYPE_LABEL,
  EVENT_FILE_STATUS_LABEL,
  EVENT_VISIBILITY_LABEL,
  normalizeEventVisibility,
  type EventFileStatus
} from "@/lib/events/event-document-types";
import { groupPublicEventDocuments } from "@/lib/events/event-visibility";
import type { PartnerEventDocument } from "@/types/event";
import { EventAllFilesPanel } from "@/components/events/event-all-files-panel";
import { EventDocumentActions } from "@/components/events/event-document-actions";

function DocumentList({
  title,
  documents,
  emptyMessage,
  onToggleRepresentative
}: {
  title: string;
  documents: PartnerEventDocument[];
  emptyMessage: string;
  onToggleRepresentative?: (docId: string, next: boolean) => void;
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {documents.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {documents.map((doc) => (
            <li key={doc.id}>
              <EventDocumentActions
                doc={doc}
                onToggleRepresentative={onToggleRepresentative}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventDetailView({
  eventId,
  publicDocuments,
  allDocuments
}: {
  eventId: string;
  publicDocuments: PartnerEventDocument[];
  allDocuments: PartnerEventDocument[];
}) {
  const [tab, setTab] = useState<"public" | "all">("public");
  const [showCollapsed, setShowCollapsed] = useState(false);
  const [docs, setDocs] = useState(allDocuments);
  const [isPending, startTransition] = useTransition();

  const grouped = useMemo(() => groupPublicEventDocuments(publicDocuments), [publicDocuments]);

  const collapsedDocs = useMemo(() => {
    const publicIds = new Set(publicDocuments.map((doc) => doc.id));
    return docs.filter((doc) => !publicIds.has(doc.id));
  }, [docs, publicDocuments]);

  async function handleToggleRepresentative(docId: string, next: boolean) {
    startTransition(async () => {
      const response = await fetch(`/api/admin/events/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRepresentative: next })
      });
      const data = await response.json();
      if (!response.ok) {
        window.alert(data.error ?? "대표자료 지정에 실패했습니다.");
        return;
      }
      setDocs((current) =>
        current.map((doc) =>
          doc.id === docId
            ? {
                ...doc,
                is_representative: next,
                file_status: next ? "representative" : "normal"
              }
            : doc
        )
      );
    });
  }

  return (
    <section id="documents" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">행사 자료</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("public")}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-semibold",
              tab === "public" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"
            ].join(" ")}
          >
            대표·일반 자료
          </button>
          <button
            type="button"
            onClick={() => setTab("all")}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-semibold",
              tab === "all" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"
            ].join(" ")}
          >
            전체 파일 보기 ({docs.length})
          </button>
        </div>
      </div>

      {tab === "public" ? (
        <div className="mt-5 space-y-6">
          <DocumentList
            title="대표 자료"
            documents={grouped.representative.filter((doc) => doc.document_type !== "photo")}
            emptyMessage="등록된 대표 자료가 없습니다."
            onToggleRepresentative={handleToggleRepresentative}
          />
          <DocumentList
            title="일반 자료"
            documents={grouped.normal}
            emptyMessage="등록된 일반 자료가 없습니다."
            onToggleRepresentative={handleToggleRepresentative}
          />
          <DocumentList
            title="대표 사진"
            documents={grouped.photos}
            emptyMessage="등록된 대표 사진이 없습니다."
            onToggleRepresentative={handleToggleRepresentative}
          />

          {collapsedDocs.length > 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
              <button
                type="button"
                onClick={() => setShowCollapsed((value) => !value)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                {showCollapsed ? "접기" : "펼치기"} — 작업본·구버전·중복·내부자료 ({collapsedDocs.length}건)
              </button>
              {showCollapsed ? (
                <ul className="mt-3 space-y-2">
                  {collapsedDocs.map((doc) => (
                    <li key={doc.id}>
                      <EventDocumentActions doc={doc} compact showMeta={false} />
                      <p className="mt-1 text-xs text-slate-500">
                        {EVENT_FILE_STATUS_LABEL[(doc.file_status ?? "excluded") as EventFileStatus] ??
                          doc.file_status}{" "}
                        · {EVENT_VISIBILITY_LABEL[normalizeEventVisibility(doc.visibility)]}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <EventAllFilesPanel eventId={eventId} documents={docs} disabled={isPending} />
      )}
    </section>
  );
}
