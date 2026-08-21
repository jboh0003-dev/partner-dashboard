"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DocumentDownloadButton,
  DocumentFileNameLink,
  DocumentPreviewButton
} from "@/components/documents/document-row-actions";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PartnerDocumentAddModal } from "@/components/partners/partner-document-add-modal";
import { groupDocumentsForPartnerTab, isVisibleDocument } from "@/lib/documents/duplicate-detection";
import {
  comparePartnerDocumentsForTab,
  getPartnerDocumentTabTypeLabel
} from "@/lib/documents/partner-tab-display";
import { formatDate } from "@/lib/utils";
import { getDocumentLastUploadedAt } from "@/lib/documents/display";
import type { PartnerDocument } from "@/types/document";

type PartnerDocumentsTabProps = {
  partnerId: string;
  documents: PartnerDocument[];
  isAdmin?: boolean;
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

export function PartnerDocumentsTab({ partnerId, documents, isAdmin = false }: PartnerDocumentsTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [tabError, setTabError] = useState<string | null>(null);

  useEffect(() => {
    setRemovedIds(new Set());
    setTabError(null);
  }, [documents]);

  const workingDocuments = useMemo(
    () => documents.filter((doc) => !removedIds.has(doc.id)),
    [documents, removedIds]
  );

  const visibleDocuments = useMemo(() => {
    const active = workingDocuments.filter((doc) => !doc.deleted_at && isVisibleDocument(doc));
    const groups = groupDocumentsForPartnerTab(active.map(toDuplicateRow));
    const byId = new Map(active.map((doc) => [doc.id, doc]));

    const representatives = groups
      .map((group) => byId.get(group.representative.id))
      .filter((doc): doc is PartnerDocument => !!doc);

    return [...representatives].sort(comparePartnerDocumentsForTab);
  }, [workingDocuments]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">파트너사별 주요 문서를 조회·관리할 수 있습니다.</p>
        {isAdmin ? (
          <button type="button" onClick={() => setAddOpen(true)} className="ui-btn-primary text-sm">
            문서 추가
          </button>
        ) : null}
      </div>

      {tabError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          {tabError}
        </div>
      ) : null}

      {workingDocuments.filter((doc) => !doc.deleted_at).length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">등록된 문서가 없습니다.</p>
          <p className="mt-2 text-sm text-slate-500">문서 추가 버튼으로 계약서, 사업자등록증 등을 등록할 수 있습니다.</p>
        </div>
      ) : visibleDocuments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">표시할 문서가 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-500 md:grid md:grid-cols-[8.5rem_1fr_7rem_7rem_auto] md:gap-3">
            <div>문서 구분</div>
            <div>파일명</div>
            <div>계약일</div>
            <div>최종 업로드일</div>
            <div />
          </div>

          <div className="divide-y divide-slate-100">
            {visibleDocuments.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                isAdmin={isAdmin}
                onDeleted={(id) => {
                  setTabError(null);
                  setRemovedIds((prev) => new Set(prev).add(id));
                }}
                onError={(message) => setTabError(message || null)}
              />
            ))}
          </div>
        </div>
      )}

      {isAdmin ? (
        <PartnerDocumentAddModal
          open={addOpen}
          partnerId={partnerId}
          onClose={() => setAddOpen(false)}
        />
      ) : null}
    </div>
  );
}

function DocumentRow({
  document,
  isAdmin,
  onDeleted,
  onError
}: {
  document: PartnerDocument;
  isAdmin: boolean;
  onDeleted: (id: string) => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [rowMessage, setRowMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [pendingReplaceFile, setPendingReplaceFile] = useState<File | null>(null);

  const documentSource = {
    document_type: document.document_type,
    display_name: document.display_name,
    file_name: document.file_name,
    original_filename: document.original_filename,
    file_ext: document.file_ext
  };

  const displayName =
    document.display_name ?? document.file_name ?? document.original_filename ?? "문서";

  async function runDelete() {
    setLoading(true);
    setRowMessage(null);
    onError("");
    try {
      const response = await fetch(`/api/partners/documents/${document.id}`, {
        method: "DELETE"
      });
      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      if (!response.ok || !json?.ok) {
        const message = json?.message ?? "삭제에 실패했습니다.";
        setRowMessage(message);
        onError(message);
        setConfirmDelete(false);
        return;
      }
      setConfirmDelete(false);
      onDeleted(document.id);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "삭제에 실패했습니다.";
      setRowMessage(message);
      onError(message);
      setConfirmDelete(false);
    } finally {
      setLoading(false);
    }
  }

  function handleReplaceClick() {
    fileInputRef.current?.click();
  }

  function handleReplaceFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPendingReplaceFile(file);
    setConfirmReplace(true);
  }

  async function runReplace() {
    if (!pendingReplaceFile) return;

    setLoading(true);
    setRowMessage(null);
    try {
      const formData = new FormData();
      formData.set("file", pendingReplaceFile);

      const response = await fetch(`/api/partners/documents/${document.id}/replace`, {
        method: "POST",
        body: formData
      });
      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      setConfirmReplace(false);
      setPendingReplaceFile(null);
      if (!response.ok || !json?.ok) {
        const message = json?.message ?? "교체에 실패했습니다.";
        setRowMessage(message);
        onError(message);
        return;
      }
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "교체에 실패했습니다.";
      setRowMessage(message);
      onError(message);
      setConfirmReplace(false);
      setPendingReplaceFile(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[8.5rem_1fr_7rem_7rem_auto] md:items-center">
        <div className="text-sm font-medium text-slate-700">
          {getPartnerDocumentTabTypeLabel(document)}
        </div>
        <div className="text-sm">
          <DocumentFileNameLink documentId={document.id} document={documentSource} />
          {rowMessage ? <p className="mt-1 text-xs text-rose-600">{rowMessage}</p> : null}
        </div>
        <div className="text-sm tabular-nums text-slate-700">
          {document.contract_date ? formatDate(document.contract_date) : "-"}
        </div>
        <div className="text-sm tabular-nums text-slate-700">
          {formatDate(getDocumentLastUploadedAt(document))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <DocumentPreviewButton documentId={document.id} document={documentSource} />
          <DocumentDownloadButton documentId={document.id} document={documentSource} />
          {isAdmin ? (
            <>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleReplaceFile} />
          <button
            type="button"
            disabled={loading}
            onClick={handleReplaceClick}
            className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
          >
            교체
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setConfirmDelete(true)}
            className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
          >
            삭제
          </button>
            </>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="문서 삭제"
        message={`「${displayName}」 문서를 삭제하시겠습니까?\n\nStorage 파일과 DB 레코드가 함께 삭제됩니다.`}
        confirmLabel="삭제"
        danger
        loading={loading}
        onCancel={() => {
          if (!loading) setConfirmDelete(false);
        }}
        onConfirm={() => {
          void runDelete();
        }}
      />

      <ConfirmDialog
        open={confirmReplace}
        title="문서 교체"
        message={`「${displayName}」 문서를 새 파일로 교체하시겠습니까?\n\n기존 Storage 파일은 삭제됩니다.`}
        confirmLabel="교체"
        loading={loading}
        onCancel={() => {
          if (loading) return;
          setConfirmReplace(false);
          setPendingReplaceFile(null);
        }}
        onConfirm={() => {
          void runReplace();
        }}
      />
    </>
  );
}
