"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CopyToast } from "@/components/common/copy-toast";
import {
  DocumentDownloadButton,
  DocumentFileNameLink,
  DocumentPreviewButton
} from "@/components/documents/document-row-actions";
import {
  confirmDocumentNormal,
  designateDocumentRepresentative,
  excludeDocumentFromReview
} from "@/app/dashboard/documents/actions";
import { DocumentRematchModal } from "@/components/documents/document-rematch-modal";
import type { DocumentMatchStatus } from "@/lib/documents/constants";
import {
  getDocumentDisplayFileName,
  getDocumentTypeShortLabel,
  getMatchStatusLabel,
  getPublicDocumentStatusLabel,
  resolveMatchStatus
} from "@/lib/documents/display";
import { isManuallyConfirmedReview } from "@/lib/documents/review-status";
import { formatDate } from "@/lib/utils";

export type DocumentListRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  extracted_partner_name: string | null;
  document_type: string | null;
  display_name: string | null;
  file_name: string;
  original_filename: string | null;
  file_ext: string | null;
  contract_date: string | null;
  created_at: string;
  match_status: string | null;
  review_status: string | null;
  grade_from_file?: string | null;
  note?: string | null;
  summary?: string | null;
  is_duplicate?: boolean | null;
  is_active?: boolean | null;
  duplicate_reason?: string | null;
};

type PartnerOption = {
  id: string;
  company_name: string;
  external_no?: string | null;
};

function toDocumentSource(row: DocumentListRow) {
  return {
    document_type: row.document_type,
    display_name: row.display_name,
    file_name: row.file_name,
    original_filename: row.original_filename,
    file_ext: row.file_ext
  };
}

function MatchStatusBadge({
  status,
  reviewStatus,
  isAdmin = false
}: {
  status: DocumentMatchStatus;
  reviewStatus?: string | null;
  isAdmin?: boolean;
}) {
  const label = isAdmin
    ? isManuallyConfirmedReview(reviewStatus)
      ? "정상"
      : getMatchStatusLabel(status)
    : getPublicDocumentStatusLabel(status);
  const className = isAdmin
    ? status === "matched"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "needs_review"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200"
    : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}>
      {label}
    </span>
  );
}

type DocumentRowActions = {
  onRematch: (row: DocumentListRow) => void;
  onAction: (documentId: string, action: "confirm" | "exclude" | "representative") => Promise<void>;
  pendingId: string | null;
  isAdmin?: boolean;
  onDelete?: (row: DocumentListRow) => void;
  onReplace?: (row: DocumentListRow) => void;
};

function buildColumns({
  onRematch,
  onAction,
  pendingId,
  isAdmin,
  onDelete,
  onReplace
}: DocumentRowActions): SortableColumn<DocumentListRow>[] {
  return [
    {
      key: "partner_name",
      label: "파트너사",
      kind: "text",
      className: "min-w-[11rem]",
      value: (row) => row.partner_name,
      render: (row) => (
        <Link
          href={`/dashboard/partners/${row.partner_id}?tab=documents`}
          className="block min-w-[11rem] max-w-[18rem] truncate whitespace-nowrap font-semibold text-okestro-600 select-text hover:text-okestro-700 hover:underline"
          title={row.partner_name}
        >
          {row.partner_name}
        </Link>
      )
    },
    {
      key: "document_type",
      label: "문서 구분",
      kind: "text",
      value: (row) => row.document_type,
      render: (row) => getDocumentTypeShortLabel(row.document_type)
    },
    {
      key: "display_name",
      label: "파일명",
      kind: "text",
      value: (row) => getDocumentDisplayFileName(toDocumentSource(row)),
      render: (row) => (
        <DocumentFileNameLink documentId={row.id} document={toDocumentSource(row)} />
      )
    },
    {
      key: "contract_date",
      label: "계약일자",
      kind: "date",
      value: (row) => row.contract_date,
      render: (row) => (row.contract_date ? formatDate(row.contract_date) : "-")
    },
    {
      key: "created_at",
      label: "업로드일",
      kind: "date",
      value: (row) => row.created_at,
      render: (row) => formatDate(row.created_at)
    },
    {
      key: "match_status",
      label: "상태",
      kind: "text",
      value: (row) => row.match_status,
      render: (row) => (
        <MatchStatusBadge
          status={resolveMatchStatus({
            match_status: row.match_status,
            review_status: row.review_status,
            document_type: row.document_type,
            partner_name: row.partner_name,
            extracted_partner_name: row.extracted_partner_name,
            summary: row.summary
          })}
          reviewStatus={row.review_status}
          isAdmin={isAdmin}
        />
      )
    },
    {
      key: "actions",
      label: "작업",
      kind: "text",
      align: "right",
      value: () => "",
      render: (row) => {
        const status = resolveMatchStatus({
          match_status: row.match_status,
          review_status: row.review_status,
          document_type: row.document_type,
          partner_name: row.partner_name,
          extracted_partner_name: row.extracted_partner_name,
          summary: row.summary
        });
        const isPending = pendingId === row.id;

        return (
          <div className="flex flex-wrap items-center justify-end gap-2 select-none">
            <DocumentPreviewButton documentId={row.id} document={toDocumentSource(row)} />
            <DocumentDownloadButton documentId={row.id} document={toDocumentSource(row)} />
            {isAdmin && status === "needs_review" ? (
              <>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => onRematch(row)}
                  className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  재매칭
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void onAction(row.id, "confirm")}
                  className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                >
                  정상 처리
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void onAction(row.id, "exclude")}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  제외
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void onAction(row.id, "representative")}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
                >
                  대표 지정
                </button>
              </>
            ) : null}
            <button
              type="button"
              disabled={isPending}
              onClick={() => onReplace?.(row)}
              className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
            >
              교체
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onDelete?.(row)}
              className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
            >
              삭제
            </button>
          </div>
        );
      }
    }
  ];
}

export function DocumentsListTable({
  rows,
  partnerOptions,
  isAdmin = false
}: {
  rows: DocumentListRow[];
  partnerOptions: PartnerOption[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rematchDocument, setRematchDocument] = useState<DocumentListRow | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<DocumentListRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentListRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleAction(
    documentId: string,
    action: "confirm" | "exclude" | "representative"
  ) {
    setPendingId(documentId);
    try {
      const result =
        action === "confirm"
          ? await confirmDocumentNormal(documentId)
          : action === "exclude"
            ? await excludeDocumentFromReview(documentId)
            : await designateDocumentRepresentative(documentId);

      if (!result.ok) {
        window.alert(result.message ?? "처리에 실패했습니다.");
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  function handleReplaceClick(row: DocumentListRow) {
    setReplaceTarget(row);
    fileInputRef.current?.click();
  }

  function handleReplaceFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !replaceTarget) return;

    startTransition(async () => {
      setError(null);
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`/api/partners/documents/${replaceTarget.id}/replace`, {
        method: "POST",
        body: formData
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setReplaceTarget(null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "교체에 실패했습니다.");
        return;
      }
      setToast("저장되었습니다.");
      router.refresh();
    });
  }

  function runDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/partners/documents/${deleteTarget.id}`, {
        method: "DELETE"
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setDeleteTarget(null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "삭제에 실패했습니다.");
        return;
      }
      setToast("삭제되었습니다.");
      router.refresh();
    });
  }

  return (
    <>
      <CopyToast message={toast} onDismiss={() => setToast(null)} />
      {error ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          {error}
        </div>
      ) : null}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleReplaceFile} />

      <ClientSortableTable
        rows={rows}
        columns={buildColumns({
          onRematch: setRematchDocument,
          onAction: handleAction,
          pendingId,
          isAdmin,
          onDelete: setDeleteTarget,
          onReplace: handleReplaceClick
        })}
        defaultSortKey="created_at"
        defaultDir="desc"
        minWidth="1120px"
        rowKey={(row) => row.id}
      />

      <DocumentRematchModal
        document={rematchDocument}
        partnerOptions={partnerOptions}
        onClose={() => setRematchDocument(null)}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="문서 삭제"
        message={
          deleteTarget
            ? `「${getDocumentDisplayFileName(toDocumentSource(deleteTarget))}」 문서를 삭제하시겠습니까?\n\nDB 레코드와 Storage 파일이 함께 삭제됩니다.`
            : ""
        }
        confirmLabel="삭제"
        danger
        loading={isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={runDelete}
      />
    </>
  );
}
