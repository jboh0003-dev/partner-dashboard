"use client";

import { useMemo, useState } from "react";
import { sortRows, type SortDir, type SortKind } from "@/lib/table-sort";

export type SortableColumn<T> = {
  key: string;
  label: string;
  kind: SortKind;
  align?: "left" | "right" | "center";
  className?: string;
  value: (row: T) => string | number | null | undefined;
  render: (row: T) => React.ReactNode;
};

type ClientSortableTableProps<T> = {
  rows: T[];
  columns: SortableColumn<T>[];
  defaultSortKey: string;
  defaultDir?: SortDir;
  minWidth?: string;
  rowKey: (row: T) => string;
};

export function ClientSortableTable<T>({
  rows,
  columns,
  defaultSortKey,
  defaultDir = "asc",
  minWidth = "960px",
  rowKey
}: ClientSortableTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [dir, setDir] = useState<SortDir>(defaultDir);

  const sortedRows = useMemo(() => {
    const column = columns.find((item) => item.key === sortKey) ?? columns[0];
    if (!column) return rows;
    return sortRows(rows, column.value, column.kind, dir);
  }, [rows, columns, sortKey, dir]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDir("asc");
  }

  return (
    <div className="ui-table-shell">
      <div className="w-full overflow-x-auto">
        <table className="w-full divide-y divide-slate-100" style={{ minWidth }}>
          <thead className="ui-table-head sticky top-0 z-[1]">
            <tr>
              {columns.map((column) => {
                const isActive = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    className={[
                      "px-5 py-3",
                      column.align === "right"
                        ? "text-right"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left",
                      column.className
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className={[
                        "inline-flex items-center gap-1.5 transition hover:text-slate-800",
                        column.align === "right" ? "ml-auto" : "",
                        column.align === "center" ? "mx-auto" : "",
                        isActive ? "text-okestro-700" : ""
                      ].join(" ")}
                      title={`${column.label} 정렬`}
                    >
                      <span>{column.label}</span>
                      <span className="text-[10px] leading-none text-okestro-600" aria-hidden>
                        {isActive ? (dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white">
            {sortedRows.map((row) => (
              <tr key={rowKey(row)} className="ui-table-row">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={[
                      "ui-table-cell",
                      column.align === "right"
                        ? "text-right tabular-nums"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left",
                      column.className
                    ].join(" ")}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
