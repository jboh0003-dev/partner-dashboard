"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import {
  DocumentDownloadButton,
  DocumentFileNameLink,
  DocumentPreviewButton
} from "@/components/documents/document-row-actions";
import { DocumentRematchModal } from "@/components/documents/document-rematch-modal";
import type { DocumentMatchStatus } from "@/lib/documents/constants";
import {
  getDocumentDisplayFileName,
  getDocumentTypeShortLabel,
  getMatchStatusLabel,
  hasPartnerNameMismatch,
  resolveMatchStatus
} from "@/lib/documents/display";
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

function MatchStatusBadge({ status }: { status: DocumentMatchStatus }) {
  const label = getMatchStatusLabel(status);
  const className =
    status === "matched"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "needs_review"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${className}`}>
      {label}
    </span>
  );
}

function buildColumns(onRematch: (row: DocumentListRow) => void): SortableColumn<DocumentListRow>[] {
  return [
    {
      key: "partner_name",
      label: "파트너사",
      kind: "text",
      className: "min-w-[11rem]",
      value: (row) => row.partner_name,
      render: (row) => {
        const mismatch = hasPartnerNameMismatch({
          partner_name: row.partner_name,
          extracted_partner_name: row.extracted_partner_name,
          match_status: row.match_status
        });

        return (
          <div className="min-w-[11rem] max-w-[18rem]">
            <Link
              href={`/dashboard/partners/${row.partner_id}?tab=documents`}
              className="block truncate whitespace-nowrap font-semibold text-okestro-600 hover:text-okestro-700 hover:underline"
              title={row.partner_name}
            >
              {row.partner_name}
            </Link>
            {mismatch && row.extracted_partner_name ? (
              <p className="mt-1 text-[11px] text-amber-700">
                파일명 추출: {row.extracted_partner_name}
              </p>
            ) : null}
          </div>
        );
      }
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
        <div className="space-y-1">
          <DocumentFileNameLink documentId={row.id} document={toDocumentSource(row)} />
          {row.is_duplicate ? (
            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              중복 숨김
            </span>
          ) : null}
          {row.duplicate_reason === "near_duplicate_candidate" ? (
            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              중복 후보
            </span>
          ) : null}
        </div>
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
            review_status: row.review_status
          })}
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
          review_status: row.review_status
        });

        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DocumentPreviewButton documentId={row.id} document={toDocumentSource(row)} />
            <DocumentDownloadButton documentId={row.id} document={toDocumentSource(row)} />
            {status === "needs_review" ? (
              <button
                type="button"
                onClick={() => onRematch(row)}
                className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
              >
                재매칭
              </button>
            ) : null}
          </div>
        );
      }
    }
  ];
}

export function DocumentsListTable({
  rows,
  partnerOptions
}: {
  rows: DocumentListRow[];
  partnerOptions: PartnerOption[];
}) {
  const router = useRouter();
  const [rematchDocument, setRematchDocument] = useState<DocumentListRow | null>(null);

  return (
    <>
      <ClientSortableTable
        rows={rows}
        columns={buildColumns(setRematchDocument)}
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
    </>
  );
}
