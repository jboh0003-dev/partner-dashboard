"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { sortRows, type SortDir, type SortKind } from "@/lib/table-sort";

export type SortableColumn<T> = {
  key: string;
  label: string;
  kind: SortKind;
  align?: "left" | "right" | "center";
  className?: string;
  /** false면 버튼/액션 셀처럼 텍스트 드래그 선택 비활성 */
  textSelectable?: boolean;
  sticky?: "left" | "right";
  stickyOffset?: number;
  value: (row: T) => string | number | null | undefined;
  render: (row: T) => React.ReactNode;
};

function isTextSelectableColumn<T>(column: SortableColumn<T>) {
  if (column.textSelectable === false) return false;
  if (column.key === "actions") return false;
  return true;
}

const CHECKBOX_STICKY_WIDTH = 40;

const DEFAULT_STICKY_LEFT_WIDTHS: Record<string, number> = {
  partner_no: 88,
  company_name: 176,
  name: 96
};

type ClientSortableTableProps<T> = {
  rows: T[];
  columns: SortableColumn<T>[];
  defaultSortKey: string;
  defaultDir?: SortDir;
  minWidth?: string;
  rowKey: (row: T) => string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
  someSelected?: boolean;
  compareRows?: (a: T, b: T, sortKey: string, dir: SortDir) => number;
  scrollable?: boolean;
  scrollMaxHeight?: string;
  getRowClassName?: (row: T, id: string) => string | undefined;
  compact?: boolean;
  dragScroll?: boolean;
  stickyLeftKeys?: string[];
  stickyRightKeys?: string[];
};

function resolveStickyLeftOffset(
  columnKey: string,
  stickyLeftKeys: string[],
  selectable: boolean
): number {
  let offset = selectable ? CHECKBOX_STICKY_WIDTH : 0;
  for (const key of stickyLeftKeys) {
    if (key === columnKey) return offset;
    offset += DEFAULT_STICKY_LEFT_WIDTHS[key] ?? 120;
  }
  return offset;
}

export function ClientSortableTable<T>({
  rows,
  columns,
  defaultSortKey,
  defaultDir = "asc",
  minWidth = "960px",
  rowKey,
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  allSelected = false,
  someSelected = false,
  compareRows,
  scrollable = false,
  scrollMaxHeight = "calc(100vh - 320px)",
  getRowClassName,
  compact = false,
  dragScroll = false,
  stickyLeftKeys = [],
  stickyRightKeys = []
}: ClientSortableTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [dir, setDir] = useState<SortDir>(defaultDir);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean; startX: number; scrollLeft: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const sortedRows = useMemo(() => {
    if (compareRows) {
      return [...rows].sort((a, b) => compareRows(a, b, sortKey, dir));
    }
    const column = columns.find((item) => item.key === sortKey) ?? columns[0];
    if (!column) return rows;
    return sortRows(rows, column.value, column.kind, dir);
  }, [rows, columns, sortKey, dir, compareRows]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDir("asc");
  }

  const isInteractiveTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest("button, a, input, select, textarea, label, [role='menu'], [data-no-drag-scroll]")
    );
  }, []);

  const onDragMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!dragScroll || !scrollRef.current || event.button !== 0) return;
      if (isInteractiveTarget(event.target)) return;
      dragRef.current = {
        active: true,
        startX: event.pageX,
        scrollLeft: scrollRef.current.scrollLeft
      };
      setIsDragging(true);
    },
    [dragScroll, isInteractiveTarget]
  );

  const onDragMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const state = dragRef.current;
    if (!state?.active || !scrollRef.current) return;
    event.preventDefault();
    const delta = event.pageX - state.startX;
    scrollRef.current.scrollLeft = state.scrollLeft - delta;
  }, []);

  const endDrag = useCallback(() => {
    if (dragRef.current?.active) {
      dragRef.current.active = false;
      setIsDragging(false);
    }
  }, []);

  const cellClass = compact ? "ui-table-cell-compact" : "ui-table-cell";
  const headCellClass = compact ? "ui-table-head-compact" : "";

  function stickyHeadClass(column: SortableColumn<T>) {
    if (stickyRightKeys.includes(column.key)) return "ui-table-sticky-right-head";
    if (stickyLeftKeys.includes(column.key)) return "ui-table-sticky-left-head";
    return "";
  }

  function stickyBodyClass(column: SortableColumn<T>) {
    if (stickyRightKeys.includes(column.key)) return "ui-table-sticky-right";
    if (stickyLeftKeys.includes(column.key)) return "ui-table-sticky-left";
    return "";
  }

  function stickyStyle(column: SortableColumn<T>): React.CSSProperties | undefined {
    if (stickyLeftKeys.includes(column.key)) {
      return {
        left: resolveStickyLeftOffset(column.key, stickyLeftKeys, selectable),
        boxShadow: "2px 0 4px -2px rgba(15, 23, 42, 0.08)"
      };
    }
    if (stickyRightKeys.includes(column.key)) {
      return {
        right: 0,
        boxShadow: "-2px 0 4px -2px rgba(15, 23, 42, 0.08)"
      };
    }
    return undefined;
  }

  const checkboxStickyStyle: React.CSSProperties | undefined =
    selectable && stickyLeftKeys.length > 0
      ? { left: 0, boxShadow: "2px 0 4px -2px rgba(15, 23, 42, 0.08)" }
      : undefined;

  return (
    <div className="ui-table-shell">
      <div
        ref={scrollRef}
        className={[
          scrollable ? "w-full overflow-auto" : "w-full overflow-x-auto",
          dragScroll ? "ui-table-drag-scroll" : "",
          isDragging ? "is-dragging" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        style={scrollable ? { maxHeight: scrollMaxHeight } : undefined}
        onMouseDown={onDragMouseDown}
        onMouseMove={onDragMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <table className="w-full divide-y divide-slate-100" style={{ minWidth }}>
          <thead
            className={[
              "ui-table-head sticky top-0 z-10 select-none shadow-[0_1px_0_0_rgba(226,232,240,0.9)]",
              headCellClass
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <tr>
              {selectable ? (
                <th
                  className={[
                    "w-10 px-3 py-3 text-left select-none",
                    compact ? "py-2" : "",
                    stickyLeftKeys.length > 0 ? "ui-table-sticky-left-head" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={checkboxStickyStyle}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = someSelected;
                    }}
                    onChange={() => onToggleAll?.()}
                    aria-label="현재 필터 결과 전체 선택"
                    className="h-4 w-4 rounded border-slate-300 select-none"
                    data-no-drag-scroll
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const isActive = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    className={[
                      compact ? "px-3 py-2" : "px-5 py-3",
                      column.align === "right"
                        ? "text-right"
                        : column.align === "center"
                          ? "text-center"
                          : "text-left",
                      stickyHeadClass(column),
                      column.className
                    ].join(" ")}
                    style={stickyStyle(column)}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className={[
                        "inline-flex select-none items-center gap-1.5 transition hover:text-slate-800",
                        column.align === "right" ? "ml-auto" : "",
                        column.align === "center" ? "mx-auto" : "",
                        isActive ? "text-okestro-700" : ""
                      ].join(" ")}
                      title={`${column.label} 정렬`}
                      data-no-drag-scroll
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
          <tbody className="divide-y divide-slate-50 bg-white select-text">
            {sortedRows.map((row) => {
              const id = rowKey(row);
              const extraRowClass = getRowClassName?.(row, id);
              return (
                <tr
                  key={id}
                  className={["ui-table-row", extraRowClass].filter(Boolean).join(" ")}
                >
                  {selectable ? (
                    <td
                      className={[
                        compact ? "px-3 py-2 align-middle" : "px-3 py-3 align-top",
                        "select-none",
                        stickyLeftKeys.length > 0 ? "ui-table-sticky-left bg-white" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={checkboxStickyStyle}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(id) ?? false}
                        onChange={() => onToggleRow?.(id)}
                        aria-label="행 선택"
                        className="h-4 w-4 rounded border-slate-300 select-none"
                        data-no-drag-scroll
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={[
                        cellClass,
                        isTextSelectableColumn(column) ? "select-text" : "select-none",
                        column.align === "right"
                          ? "text-right tabular-nums"
                          : column.align === "center"
                            ? "text-center"
                            : "text-left",
                        stickyBodyClass(column),
                        column.className
                      ].join(" ")}
                      style={stickyStyle(column)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
