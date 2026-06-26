"use client";

import { useMemo } from "react";
import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { TableCopyToolbar } from "@/components/common/table-copy-toolbar";
import { useTableSelection } from "@/hooks/use-table-selection";
import type { CopyableRow } from "@/lib/clipboard/table-copy";
import type { CsvRow } from "@/lib/csv";
import type { SortDir } from "@/lib/table-sort";

type CopyableDataTableProps<T> = {
  rows: T[];
  columns: SortableColumn<T>[];
  rowKey: (row: T) => string;
  toCopyableRow: (row: T) => CopyableRow;
  selectedRowTsv: {
    headers: readonly string[];
    getValues: (row: CopyableRow) => string[];
  };
  defaultSortKey: string;
  defaultDir?: SortDir;
  minWidth?: string;
  csvRows?: CsvRow[];
  csvFilenamePrefix?: string;
};

export function CopyableDataTable<T>({
  rows,
  columns,
  rowKey,
  toCopyableRow,
  selectedRowTsv,
  defaultSortKey,
  defaultDir = "asc",
  minWidth,
  csvRows,
  csvFilenamePrefix
}: CopyableDataTableProps<T>) {
  const getRowId = useMemo(() => rowKey, [rowKey]);
  const selection = useTableSelection(rows, getRowId);

  const copyableRows = useMemo(
    () => rows.map((row) => toCopyableRow(row)),
    [rows, toCopyableRow]
  );

  return (
    <>
      <TableCopyToolbar
        allRows={copyableRows}
        selectedIds={selection.selectedIds}
        selectedCount={selection.selectedCount}
        filterResultCount={rows.length}
        onClearSelection={selection.clearSelection}
        selectedRowTsv={selectedRowTsv}
        csvRows={csvRows}
        csvFilenamePrefix={csvFilenamePrefix}
      />
      <ClientSortableTable
        rows={rows}
        columns={columns}
        defaultSortKey={defaultSortKey}
        defaultDir={defaultDir}
        minWidth={minWidth}
        rowKey={getRowId}
        selectable
        selectedIds={selection.selectedIds}
        onToggleRow={selection.toggleRow}
        onToggleAll={selection.toggleAll}
        allSelected={selection.allSelected}
        someSelected={selection.someSelected}
      />
    </>
  );
}
