"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CopyToast } from "@/components/common/copy-toast";
import { TableCopyToolbar } from "@/components/common/table-copy-toolbar";
import { TableText, TABLE_LINK_NAME_CLASS } from "@/components/common/table-cells";
import { ContactRoleBadges } from "@/components/contacts/contact-role-badges";
import { PartnerContactFormModal } from "@/components/partners/partner-contact-form-modal";
import { useTableSelection } from "@/hooks/use-table-selection";
import {
  CONTACT_SELECTED_ROW_TSV,
  contactRowToCopyable
} from "@/lib/clipboard/row-mappers";
import { compareContactTableRows } from "@/lib/contacts/table-sort";
import type { PersonContactRow } from "@/lib/contacts/person-groups";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import type { SortDir } from "@/lib/table-sort";
import type { CsvRow } from "@/lib/csv";
import type { PartnerContact } from "@/types/partner";

type PartnerOption = { id: string; company_name: string };

type ConfirmAction =
  | { type: "deactivate"; row: PersonContactRow }
  | { type: "delete"; row: PersonContactRow; linkedHistoryCount: number }
  | { type: "bulk_deactivate"; count: number; ids: string[] };

type ContactsAdminTableProps = {
  rows: PersonContactRow[];
  totalCount?: number;
  countLabel?: string;
  csvRows?: CsvRow[];
  partnerOptions: PartnerOption[];
  defaultPartnerId?: string;
  embedded?: boolean;
  showReviewReason?: boolean;
};

export function ContactsAdminTable({
  rows,
  totalCount,
  countLabel,
  csvRows,
  partnerOptions,
  defaultPartnerId,
  embedded = false,
  showReviewReason = false
}: ContactsAdminTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selection = useTableSelection(rows, (row) => row.id);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PartnerContact | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmAction | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const copyableRows = useMemo(() => rows.map((row) => contactRowToCopyable(row)), [rows]);

  function openCreate() {
    setEditingContact(null);
    setFormOpen(true);
  }

  const openEdit = useCallback((row: PersonContactRow) => {
    setEditingContact(rowToContact(row));
    setFormOpen(true);
  }, []);

  const openDeleteConfirm = useCallback(async (row: PersonContactRow) => {
    setLoadingHistory(true);
    setError(null);
    try {
      const response = await fetch(`/api/contacts/${row.id}`);
      const json = (await response.json().catch(() => null)) as {
        training_history?: unknown[];
      } | null;
      const linkedHistoryCount = json?.training_history?.length ?? 0;
      setConfirmState({ type: "delete", row, linkedHistoryCount });
    } catch {
      setConfirmState({ type: "delete", row, linkedHistoryCount: 0 });
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const columns: SortableColumn<PersonContactRow>[] = useMemo(() => {
    const base: SortableColumn<PersonContactRow>[] = [
      {
        key: "partner_no",
        label: "파트너번호",
        kind: "partner_no",
        className: "min-w-[5.5rem] whitespace-nowrap",
        value: (row) => row.partner_no,
        render: (row) => (
          <Link
            href={`/dashboard/partners/${row.partner_id}`}
            className="tabular-nums font-medium text-okestro-600 select-text hover:text-okestro-700 hover:underline"
            title={formatPartnerNo({ external_no: row.partner_no })}
            data-no-drag-scroll
          >
            {formatPartnerNo({ external_no: row.partner_no })}
          </Link>
        )
      },
      {
        key: "company_name",
        label: "회사명",
        kind: "text",
        className: "min-w-[11rem] max-w-[11rem]",
        value: (row) => row.company_name,
        render: (row) => (
          <Link
            href={`/dashboard/partners/${row.partner_id}`}
            className={`${TABLE_LINK_NAME_CLASS} max-w-[11rem]`}
            title={row.company_name}
            data-no-drag-scroll
          >
            {row.company_name}
          </Link>
        )
      },
      {
        key: "name",
        label: "이름",
        kind: "text",
        className: "min-w-[6rem] whitespace-nowrap",
        value: (row) => row.name,
        render: (row) => (
          <span className="inline-flex min-w-0 items-center gap-1">
            <TableText
              value={row.name}
              className="block min-w-[6rem] max-w-[8rem] truncate whitespace-nowrap text-[13px] font-medium text-slate-900"
            />
            {row.review_required && !showReviewReason ? (
              <span className="rounded bg-amber-50 px-1 py-0.5 text-[10px] font-semibold text-amber-800">
                확인
              </span>
            ) : null}
          </span>
        )
      }
    ];

    if (showReviewReason) {
      base.push({
        key: "review_reason",
        label: "확인 사유",
        kind: "text",
        className: "min-w-[10rem] max-w-[14rem]",
        value: (row) => row.review_reason ?? "",
        render: (row) => (
          <span
            className="block max-w-[14rem] truncate whitespace-nowrap text-[12px] text-amber-900"
            title={row.review_reason ?? undefined}
          >
            {row.review_reason ?? "-"}
          </span>
        )
      });
    }

    base.push(
      {
        key: "assignment",
        label: "담당구분",
        kind: "text",
        className: "min-w-[7rem] max-w-[10rem]",
        value: (row) => row.display_role_labels.join(", "),
        render: (row) => <ContactRoleBadges labels={row.role_labels} maxVisible={2} />
      },
      {
        key: "department",
        label: "부서/직급",
        kind: "text",
        className: "min-w-[8rem] max-w-[12rem]",
        value: (row) => [row.department, row.position].filter(Boolean).join(" / "),
        render: (row) => (
          <TableText
            value={[row.department, row.position].filter(Boolean).join(" / ")}
            className="block max-w-[12rem] truncate whitespace-nowrap text-[13px] text-slate-700"
          />
        )
      },
      {
        key: "phone",
        label: "연락처",
        kind: "text",
        className: "min-w-[8rem] whitespace-nowrap",
        value: (row) => row.display_phone ?? row.phone,
        render: (row) => (
          <PhoneCell
            displayPhone={row.display_phone ?? row.phone}
            extraCount={row.extra_phone_count}
            needsReview={row.phone_needs_review}
          />
        )
      },
      {
        key: "email",
        label: "이메일",
        kind: "text",
        className: "min-w-[10rem] max-w-[14rem]",
        value: (row) => row.email,
        render: (row) => (
          <span
            className="block max-w-[14rem] truncate whitespace-nowrap text-[13px] text-slate-700"
            title={row.email ?? undefined}
          >
            {row.email ?? <span className="text-amber-700">미입력</span>}
            {row.has_bounced_email ? (
              <span className="ml-1 rounded bg-rose-50 px-1 py-0.5 text-[10px] font-semibold text-rose-700">
                반송
              </span>
            ) : null}
            {row.extra_email_count > 0 ? (
              <span className="ml-1 text-[11px] text-slate-400">외 {row.extra_email_count}개</span>
            ) : null}
          </span>
        )
      },
      {
        key: "actions",
        label: "관리",
        kind: "text",
        align: "right",
        className: "min-w-[9rem] w-[9rem]",
        textSelectable: false,
        value: () => "",
        render: (row) => (
          <RowActions
            row={row}
            showReviewActions={showReviewReason || Boolean(row.review_required)}
            loadingHistory={loadingHistory}
            onEdit={() => openEdit(row)}
            onDeactivate={() => setConfirmState({ type: "deactivate", row })}
            onDelete={() => void openDeleteConfirm(row)}
            onConfirmReview={() => runConfirmReview(row)}
            onMerge={() => runMergeDuplicates(row)}
          />
        )
      }
    );

    return base;
  }, [loadingHistory, openDeleteConfirm, openEdit, showReviewReason]);

  const compareRows = useCallback(
    (a: PersonContactRow, b: PersonContactRow, sortKey: string, dir: SortDir) =>
      compareContactTableRows(a, b, sortKey, dir, columns),
    [columns]
  );

  function runDeactivate(row: PersonContactRow) {
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/contacts/${row.id}/deactivate`, { method: "POST" });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setConfirmState(null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "비활성화에 실패했습니다.");
        return;
      }
      setToast("비활성화되었습니다.");
      selection.clearSelection();
      router.refresh();
    });
  }

  function runDelete(row: PersonContactRow) {
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/contacts/${row.id}`, { method: "DELETE" });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      setConfirmState(null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "삭제에 실패했습니다.");
        return;
      }
      setToast("삭제 처리되었습니다.");
      selection.clearSelection();
      router.refresh();
    });
  }

  function runMergeDuplicates(row: PersonContactRow) {
    const targetId = row.id;
    const sourceIds = row.member_ids.filter((memberId) => memberId !== targetId);
    if (sourceIds.length === 0) return;

    startTransition(async () => {
      setError(null);
      for (const sourceId of sourceIds) {
        const response = await fetch(`/api/contacts/${sourceId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "merge", merge_target_id: targetId })
        });
        const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!response.ok || !json?.ok) {
          setError(json?.message ?? "병합에 실패했습니다.");
          return;
        }
      }
      setToast(`${sourceIds.length}건 병합되었습니다.`);
      router.refresh();
    });
  }

  function runConfirmReview(row: PersonContactRow) {
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/contacts/${row.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "keep_active" })
      });
      const json = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "확인 완료 처리에 실패했습니다.");
        return;
      }
      setToast("확인 완료 처리되었습니다.");
      router.refresh();
    });
  }

  function runBulkDeactivate(ids: string[]) {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "deactivate" })
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        errors?: string[];
        deactivated_count?: number;
      } | null;
      setConfirmState(null);
      if (!response.ok) {
        setError(json?.message ?? json?.errors?.join(" / ") ?? "일괄 비활성화에 실패했습니다.");
        return;
      }
      if (json?.errors?.length) {
        setError(json.errors.join(" / "));
      }
      if ((json?.deactivated_count ?? 0) > 0) {
        setToast(`${json?.deactivated_count ?? 0}명 비활성화되었습니다.`);
        selection.clearSelection();
        router.refresh();
      }
    });
  }

  return (
    <>
      <CopyToast message={toast} onDismiss={() => setToast(null)} />

      <div
        className={
          embedded
            ? "flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"
            : "mb-3 flex flex-wrap items-center justify-between gap-2"
        }
      >
        <button type="button" onClick={openCreate} className="ui-btn-primary text-sm">
          담당자 추가
        </button>
        {selection.selectedCount > 0 ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              setConfirmState({
                type: "bulk_deactivate",
                count: selection.selectedCount,
                ids: [...selection.selectedIds]
              })
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            data-no-drag-scroll
          >
            선택 비활성화 ({selection.selectedCount})
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <TableCopyToolbar
        allRows={copyableRows}
        selectedIds={selection.selectedIds}
        selectedCount={selection.selectedCount}
        totalCount={totalCount ?? rows.length}
        countLabel={countLabel}
        onClearSelection={selection.clearSelection}
        selectedRowTsv={CONTACT_SELECTED_ROW_TSV}
        csvRows={csvRows}
        csvFilenamePrefix="partner-contacts"
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          조건에 맞는 담당자가 없습니다. 담당자 추가 버튼으로 신규 등록할 수 있습니다.
        </div>
      ) : (
        <ClientSortableTable
          rows={rows}
          columns={columns}
          defaultSortKey="partner_no"
          defaultDir="asc"
          minWidth="1100px"
          rowKey={(row) => row.id}
          compareRows={compareRows}
          selectable
          selectedIds={selection.selectedIds}
          onToggleRow={selection.toggleRow}
          onToggleAll={selection.toggleAll}
          allSelected={selection.allSelected}
          someSelected={selection.someSelected}
          compact
          scrollable
          scrollMaxHeight="calc(100vh - 360px)"
          dragScroll
          stickyLeftKeys={["partner_no", "company_name", "name"]}
          stickyRightKeys={["actions"]}
        />
      )}

      <PartnerContactFormModal
        open={formOpen}
        contact={editingContact}
        partnerId={editingContact?.partner_id ?? defaultPartnerId}
        partnerOptions={partnerOptions}
        defaultPartnerId={defaultPartnerId}
        fullEdit
        onClose={() => {
          setFormOpen(false);
          setEditingContact(null);
        }}
      />

      <ConfirmDialog
        open={confirmState?.type === "deactivate"}
        title="담당자 비활성화"
        message="이 담당자를 비활성 처리하시겠습니까? 현재 인력 목록과 메일 발송 대상에서 제외되지만 이력은 유지됩니다."
        confirmLabel="비활성화"
        danger
        loading={isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState?.type === "deactivate") runDeactivate(confirmState.row);
        }}
      />

      <ConfirmDialog
        open={confirmState?.type === "delete"}
        title="담당자 삭제"
        message={
          confirmState?.type === "delete"
            ? confirmState.linkedHistoryCount > 0
              ? `교육/행사 이력 ${confirmState.linkedHistoryCount}건이 연결되어 있습니다. 삭제 시 목록과 발송 대상에서 제외되며 이력은 유지됩니다.`
              : "이 담당자를 삭제하시겠습니까? 목록과 발송 대상에서 제외됩니다."
            : ""
        }
        confirmLabel="삭제"
        danger
        loading={isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState?.type === "delete") runDelete(confirmState.row);
        }}
      />

      <ConfirmDialog
        open={confirmState?.type === "bulk_deactivate"}
        title="선택 담당자 비활성화"
        message={
          confirmState?.type === "bulk_deactivate"
            ? `선택한 담당자 ${confirmState.count}명을 비활성 처리하시겠습니까?`
            : ""
        }
        confirmLabel="비활성화"
        danger
        loading={isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState?.type === "bulk_deactivate") runBulkDeactivate(confirmState.ids);
        }}
      />
    </>
  );
}

function PhoneCell({
  displayPhone,
  extraCount,
  needsReview
}: {
  displayPhone: string | null;
  extraCount: number;
  needsReview: boolean;
}) {
  if (!displayPhone) {
    return <span className="text-[13px] text-slate-400">-</span>;
  }

  return (
    <span
      className="inline-flex min-w-[8rem] max-w-[10rem] items-center gap-1 truncate whitespace-nowrap text-[13px] text-slate-700"
      title={displayPhone}
    >
      {displayPhone}
      {extraCount > 0 ? (
        <span className="text-[11px] text-slate-400">외 {extraCount}개</span>
      ) : null}
      {needsReview ? (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700"
          title="연락처 형식 확인 필요"
        >
          <AlertTriangle size={11} />
          확인
        </span>
      ) : null}
    </span>
  );
}

function RowActions({
  row,
  showReviewActions,
  loadingHistory,
  onEdit,
  onDeactivate,
  onDelete,
  onConfirmReview,
  onMerge
}: {
  row: PersonContactRow;
  showReviewActions: boolean;
  loadingHistory: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onConfirmReview: () => void;
  onMerge: () => void;
}) {
  const canMerge = row.is_merge_candidate && row.member_ids.length > 1;

  return (
    <div className="inline-flex items-center justify-end gap-0.5 whitespace-nowrap" data-no-drag-scroll>
      <ActionButton onClick={onEdit}>수정</ActionButton>
      {canMerge ? (
        <ActionButton tone="success" onClick={onMerge}>
          병합
        </ActionButton>
      ) : null}
      <ActionButton onClick={onDeactivate}>비활성화</ActionButton>
      <ActionButton tone="danger" onClick={onDelete} disabled={loadingHistory}>
        삭제
      </ActionButton>
      {showReviewActions ? (
        <ActionButton tone="success" onClick={onConfirmReview}>
          확인완료
        </ActionButton>
      ) : null}
    </div>
  );
}

function rowToContact(row: PersonContactRow): PartnerContact {
  return {
    id: row.id,
    partner_id: row.partner_id,
    name: row.name,
    department: row.department,
    position: row.position,
    role_type: row.role_type,
    role_raw: row.role_raw ?? null,
    email: row.email,
    phone: row.phone,
    is_primary: false,
    is_contract_contact: row.is_contract_contact,
    source_file: null,
    last_synced_at: null,
    memo: row.memo ?? null,
    created_at: row.created_at ?? new Date().toISOString()
  };
}

function ActionButton({
  children,
  onClick,
  tone = "default",
  disabled = false
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "danger" | "success";
  disabled?: boolean;
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50"
      : tone === "success"
        ? "border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
        : "border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-700";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-6 items-center rounded border px-1.5 text-[10px] font-semibold disabled:opacity-50 ${toneClass}`}
      data-no-drag-scroll
    >
      {children}
    </button>
  );
}
