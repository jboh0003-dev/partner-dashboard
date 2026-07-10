"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CopyToast } from "@/components/common/copy-toast";
import { TableCopyToolbar } from "@/components/common/table-copy-toolbar";
import { TableText } from "@/components/common/table-cells";
import { PartnerBasicInfoEditModal } from "@/components/partners/partner-basic-info-edit-modal";
import { useTableSelection } from "@/hooks/use-table-selection";
import {
  getDisplayPartnerGrade,
  getDisplayPartnerGradeLabel
} from "@/lib/partners/grade";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import type { Partner } from "@/types/partner";
import type { PartnerListRow } from "@/lib/partners/list";
import { formatDate } from "@/lib/utils";
import {
  PARTNER_SELECTED_ROW_TSV,
  partnerRowToCopyable
} from "@/lib/clipboard/row-mappers";
import type { CsvRow } from "@/lib/csv";

type PartnerAdminTableProps = {
  rows: PartnerListRow[];
  csvRows?: CsvRow[];
};

type DeleteConfirmState =
  | { type: "single"; row: PartnerListRow }
  | { type: "bulk"; ids: string[] }
  | null;

const PREVIEW_NAME_LIMIT = 3;

function buildDuplicatePartnerNos(rows: PartnerListRow[]): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const no = row.partner.external_no?.trim();
    if (!no) continue;
    counts.set(no, (counts.get(no) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([no]) => no)
  );
}

function buildDeletePreviewItems(
  rows: PartnerListRow[],
  ids: string[]
): Array<{ id: string; company_name: string }> {
  const idSet = new Set(ids);
  return rows
    .filter((row) => idSet.has(row.partner.id))
    .map((row) => ({ id: row.partner.id, company_name: row.partner.company_name }));
}

export function PartnerAdminTable({ rows, csvRows }: PartnerAdminTableProps) {
  const router = useRouter();
  const [localRows, setLocalRows] = useState(rows);
  const [isPending, startTransition] = useTransition();
  const selection = useTableSelection(localRows, (row) => row.partner.id);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editPartner, setEditPartner] = useState<PartnerListRow["partner"] | null>(null);
  const [confirmState, setConfirmState] = useState<DeleteConfirmState>(null);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const duplicatePartnerNos = useMemo(
    () => buildDuplicatePartnerNos(localRows),
    [localRows]
  );

  const copyableRows = useMemo(
    () => localRows.map((row) => partnerRowToCopyable(row)),
    [localRows]
  );

  function handlePartnerSaved(updated: Partner) {
    setLocalRows((current) =>
      current.map((row) =>
        row.partner.id === updated.id ? { ...row, partner: updated } : row
      )
    );
    startTransition(() => router.refresh());
  }

  function removeRowsFromList(ids: string[]) {
    const idSet = new Set(ids);
    setLocalRows((current) => current.filter((row) => !idSet.has(row.partner.id)));
  }

  const columns: SortableColumn<PartnerListRow>[] = useMemo(
    () => [
      {
        key: "external_no",
        label: "번호",
        kind: "partner_no",
        className: "min-w-[5rem] whitespace-nowrap",
        value: (row) => row.partner.external_no,
        render: (row) => {
          const partnerNo = formatPartnerNo(row.partner);
          const rawNo = row.partner.external_no?.trim() ?? "";
          const isDuplicate = rawNo ? duplicatePartnerNos.has(rawNo) : false;

          return (
            <div className="flex flex-col gap-1">
              <Link
                href={`/dashboard/partners/${row.partner.id}`}
                className="tabular-nums font-medium text-okestro-600 select-text hover:text-okestro-700 hover:underline"
                title={partnerNo}
              >
                {partnerNo}
              </Link>
              {isDuplicate ? (
                <span className="inline-flex w-fit rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200/80">
                  중복 가능
                </span>
              ) : null}
            </div>
          );
        }
      },
      {
        key: "company_name",
        label: "회사명",
        kind: "text",
        className: "min-w-[11rem]",
        value: (row) => row.partner.company_name,
        render: (row) => (
          <Link
            href={`/dashboard/partners/${row.partner.id}`}
            title={row.partner.company_name}
            className="block min-w-[11rem] max-w-[18rem] truncate whitespace-nowrap font-semibold text-blue-700 transition select-text hover:text-blue-900 hover:underline"
          >
            {row.partner.company_name}
          </Link>
        )
      },
      {
        key: "grade",
        label: "등급",
        kind: "grade",
        value: (row) => getDisplayPartnerGrade(row.partner),
        render: (row) => getDisplayPartnerGradeLabel(row.partner)
      },
      {
        key: "contract_start_date",
        label: "계약일자",
        kind: "date",
        value: (row) => row.partner.contract_start_date,
        render: (row) =>
          row.partner.contract_start_date ? formatDate(row.partner.contract_start_date) : "-"
      },
      {
        key: "contact_name",
        label: "담당자명",
        kind: "text",
        value: (row) => row.contactName,
        render: (row) => row.contactName ?? "-"
      },
      {
        key: "contact_position",
        label: "직급",
        kind: "text",
        value: (row) => row.contactPosition,
        render: (row) => row.contactPosition ?? "-"
      },
      {
        key: "contact_phone",
        label: "연락처",
        kind: "text",
        value: (row) => row.contactPhone,
        render: (row) => row.contactPhone ?? "-"
      },
      {
        key: "contact_email",
        label: "이메일",
        kind: "text",
        value: (row) => row.contactEmail,
        render: (row) => (
          <TableText
            value={row.contactEmail}
            className="block min-w-[10rem] max-w-[18rem] break-keep whitespace-normal"
          />
        )
      },
      {
        key: "actions",
        label: "관리",
        kind: "text",
        align: "right",
        value: () => "",
        render: (row) => (
          <div className="flex flex-wrap items-center justify-end gap-1.5 select-none">
            <ActionLink href={`/dashboard/partners/${row.partner.id}`}>보기</ActionLink>
            <ActionButton onClick={() => setEditPartner(row.partner)}>수정</ActionButton>
            <ActionButton danger onClick={() => setConfirmState({ type: "single", row })}>
              삭제
            </ActionButton>
          </div>
        )
      }
    ],
    [duplicatePartnerNos]
  );

  const getRowClassName = useCallback(
    (_row: PartnerListRow, id: string) =>
      selection.selectedIds.has(id) ? "bg-blue-50/70 hover:bg-blue-50/80" : undefined,
    [selection.selectedIds]
  );

  function runDeleteSingle(row: PartnerListRow) {
    startTransition(async () => {
      setError(null);
      const response = await fetch(`/api/partners/${row.partner.id}`, {
        method: "DELETE"
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;
      setConfirmState(null);
      if (!response.ok || !json?.ok) {
        setError(json?.message ?? "삭제에 실패했습니다.");
        return;
      }
      removeRowsFromList([row.partner.id]);
      selection.clearSelection();
      setToast("삭제되었습니다.");
      startTransition(() => router.refresh());
    });
  }

  function runBulkDelete(ids: string[]) {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/partners/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids })
      });
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        errors?: string[];
        deleted_count?: number;
        deleted_ids?: string[];
      } | null;
      setConfirmState(null);

      if (!response.ok) {
        setError(json?.message ?? json?.errors?.join(" / ") ?? "일괄 삭제에 실패했습니다.");
        return;
      }

      if (json?.errors?.length) {
        setError(json.errors.join(" / "));
      }

      const deletedIds = json?.deleted_ids ?? ids;
      if ((json?.deleted_count ?? 0) > 0) {
        removeRowsFromList(deletedIds);
        selection.clearSelection();
        setToast(`${json?.deleted_count ?? deletedIds.length}개 파트너사가 삭제되었습니다.`);
        startTransition(() => router.refresh());
      }
    });
  }

  const bulkPreviewItems =
    confirmState?.type === "bulk"
      ? buildDeletePreviewItems(localRows, confirmState.ids)
      : [];
  const bulkDeleteCount =
    confirmState?.type === "bulk" ? confirmState.ids.length : 0;

  return (
    <>
      <CopyToast message={toast} onDismiss={() => setToast(null)} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          총{" "}
          <span className="font-semibold text-slate-700">
            {localRows.length.toLocaleString("ko-KR")}
          </span>
          개의 파트너사가 검색되었습니다.
        </div>
        <button
          type="button"
          disabled={selection.selectedCount === 0 || isPending}
          onClick={() =>
            setConfirmState({
              type: "bulk",
              ids: [...selection.selectedIds]
            })
          }
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {selection.selectedCount > 0
            ? `선택 삭제 (${selection.selectedCount})`
            : "선택 삭제"}
        </button>
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
        totalCount={localRows.length}
        onClearSelection={selection.clearSelection}
        selectedRowTsv={PARTNER_SELECTED_ROW_TSV}
        csvRows={csvRows}
        csvFilenamePrefix="partners"
      />

      <ClientSortableTable
        rows={localRows}
        columns={columns}
        defaultSortKey="external_no"
        defaultDir="asc"
        minWidth="1280px"
        rowKey={(row) => row.partner.id}
        selectable
        selectedIds={selection.selectedIds}
        onToggleRow={selection.toggleRow}
        onToggleAll={selection.toggleAll}
        allSelected={selection.allSelected}
        someSelected={selection.someSelected}
        scrollable
        scrollMaxHeight="calc(100vh - 320px)"
        getRowClassName={getRowClassName}
      />

      {editPartner ? (
        <PartnerBasicInfoEditModal
          partner={editPartner}
          open={Boolean(editPartner)}
          onClose={() => setEditPartner(null)}
          onSaved={handlePartnerSaved}
        />
      ) : null}

      <ConfirmDialog
        open={confirmState?.type === "single"}
        title="파트너사 삭제"
        message={
          "정말 이 파트너사를 삭제하시겠습니까?\n연결된 담당자, 문서, 교육 이력은 보존되지만 화면에서는 숨김 처리됩니다."
        }
        confirmLabel="삭제"
        danger
        loading={isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState?.type === "single") runDeleteSingle(confirmState.row);
        }}
      />

      <ConfirmDialog
        open={confirmState?.type === "bulk"}
        title="선택 파트너사 삭제"
        message={`선택한 파트너사 ${bulkDeleteCount}개를 삭제하시겠습니까?\n연결된 담당자, 문서, 교육 이력은 보존되지만 화면에서는 숨김 처리됩니다.`}
        confirmLabel={`삭제 (${bulkDeleteCount})`}
        danger
        loading={isPending}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => {
          if (confirmState?.type === "bulk") runBulkDelete(confirmState.ids);
        }}
      >
        {bulkPreviewItems.length > 0 ? (
          <ul className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {bulkPreviewItems.slice(0, PREVIEW_NAME_LIMIT).map((item) => (
              <li key={item.id} className="truncate py-0.5">
                · {item.company_name}
              </li>
            ))}
            {bulkPreviewItems.length > PREVIEW_NAME_LIMIT ? (
              <li className="py-0.5 text-slate-500">
                · 외 {bulkPreviewItems.length - PREVIEW_NAME_LIMIT}건
              </li>
            ) : null}
          </ul>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-700"
    >
      {children}
    </Link>
  );
}

function ActionButton({
  children,
  onClick,
  danger = false
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        danger
          ? "rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 hover:bg-rose-100"
          : "rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100"
      }
    >
      {children}
    </button>
  );
}
