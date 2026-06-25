"use client";

import { useMemo } from "react";
import {
  DocumentDownloadButton,
  DocumentFileNameLink,
  DocumentPreviewButton
} from "@/components/documents/document-row-actions";
import { groupDocumentsForPartnerTab, isVisibleDocument } from "@/lib/documents/duplicate-detection";
import {
  comparePartnerDocumentsForTab,
  getPartnerDocumentTabTypeLabel
} from "@/lib/documents/partner-tab-display";
import { formatDate } from "@/lib/utils";
import type { PartnerDocument } from "@/types/document";

type PartnerDocumentsTabProps = {
  documents: PartnerDocument[];
};

function toDuplicateRow(doc: PartnerDocument) {
  return {
    id: doc.id,
    partner_id: doc.partner_id,
    document_type: doc.document_type,
    original_filename: doc.original_filename,
    display_name: doc.display_name,
    file_name: doc.file_name,
    file_size: doc.file_size,
    created_at: doc.created_at,
    is_active: doc.is_active,
    is_duplicate: doc.is_duplicate,
    duplicate_of: doc.duplicate_of,
    priority_score: doc.priority_score
  };
}

export function PartnerDocumentsTab({ documents }: PartnerDocumentsTabProps) {
  const visibleDocuments = useMemo(() => {
    const active = documents.filter((doc) => !doc.deleted_at && isVisibleDocument(doc));
    const groups = groupDocumentsForPartnerTab(active.map(toDuplicateRow));
    const byId = new Map(active.map((doc) => [doc.id, doc]));

    const representatives = groups
      .map((group) => byId.get(group.representative.id))
      .filter((doc): doc is PartnerDocument => !!doc);

    return [...representatives].sort(comparePartnerDocumentsForTab);
  }, [documents]);

  if (documents.filter((doc) => !doc.deleted_at).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-700">등록된 문서가 없습니다.</p>
        <p className="mt-2 text-sm text-slate-500">
          문서 업로드 메뉴에서 파트너 신청서, 사업자등록증 등을 등록할 수 있습니다.
        </p>
      </div>
    );
  }

  if (visibleDocuments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-700">표시할 문서가 없습니다.</p>
        <p className="mt-2 text-sm text-slate-500">
          파트너사별 주요 문서를 조회할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">파트너사별 주요 문서를 조회할 수 있습니다.</p>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500 md:grid md:grid-cols-[8.5rem_1fr_7rem_7rem_auto] md:gap-3">
          <div>문서 구분</div>
          <div>파일명</div>
          <div>계약일</div>
          <div>등록일</div>
          <div />
        </div>

        <div className="divide-y divide-slate-100">
          {visibleDocuments.map((document) => (
            <DocumentRow key={document.id} document={document} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentRow({ document }: { document: PartnerDocument }) {
  const documentSource = {
    document_type: document.document_type,
    display_name: document.display_name,
    file_name: document.file_name,
    original_filename: document.original_filename,
    file_ext: document.file_ext
  };

  return (
    <div className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[8.5rem_1fr_7rem_7rem_auto] md:items-center">
      <div className="text-sm font-medium text-slate-700">
        {getPartnerDocumentTabTypeLabel(document)}
      </div>
      <div className="text-sm">
        <DocumentFileNameLink documentId={document.id} document={documentSource} />
      </div>
      <div className="text-sm tabular-nums text-slate-700">
        {document.contract_date ? formatDate(document.contract_date) : "-"}
      </div>
      <div className="text-sm tabular-nums text-slate-700">{formatDate(document.created_at)}</div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <DocumentPreviewButton documentId={document.id} document={documentSource} />
        <DocumentDownloadButton documentId={document.id} document={documentSource} />
      </div>
    </div>
  );
}
