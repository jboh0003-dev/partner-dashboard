"use client";

import { ListFilter, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sortRows, type SortDir, type SortKind } from "@/lib/table-sort";

const EMPTY_FILTER_VALUE = "__PARTNER_CONNECT_EMPTY_FILTER_VALUE__";

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
  /** Excel형 열 필터에서 사용할 값. 여러 담당구분처럼 한 행이 복수 값이면 배열로 반환 */
  filterValues?: (row: T) => Array<string | number | null | undefined>;
  /** false면 Excel형 열 필터 버튼을 숨김 */
  filterable?: boolean;
  value: (row: T) => string | number | null | undefined;
  render: (row: T) => React.ReactNode;
};

function isTextSelectableColumn<T>(column: SortableColumn<T>) {
  if (column.textSelectable === false) return false;
  if (column.key === "actions") return false;
  return true;
}

function normalizeFilterValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_FILTER_VALUE;
  const normalized = String(value).trim();
  return normalized || EMPTY_FILTER_VALUE;
}

function displayFilterValue(value: string): string {
  return value === EMPTY_FILTER_VALUE ? "(빈 셀)" : value;
}

function rowFilterValues<T>(column: SortableColumn<T>, row: T): string[] {
  const rawValues = column.filterValues?.(row) ?? [column.value(row)];
  const normalized = [...new Set(rawValues.map(normalizeFilterValue))];
  return normalized.length > 0 ? normalized : [EMPTY_FILTER_VALUE];
}

function isFilterableColumn<T>(column: SortableColumn<T>, excelFilters: boolean) {
  if (!excelFilters || column.filterable === false) return false;
  return column.key !== "actions" && column.key !== "detail";
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
  onReplaceSelection?: (ids: string[]) => void;
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
  /** 각 열 헤더에 Excel처럼 값 목록 체크 필터 표시 */
  excelFilters?: boolean;
  pageSize?: number;
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
  onReplaceSelection,
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
  stickyRightKeys = [],
  excelFilters = false,
  pageSize = 0
}: ClientSortableTableProps<T>) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [dir, setDir] = useState<SortDir>(defaultDir);
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({});
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean; startX: number; scrollLeft: number } | null>(null);
  const selectionDragRef = useRef<{
    active: boolean;
    startIndex: number;
    mode: "select" | "deselect";
    base: Set<string>;
  } | null>(null);
  const selectionAnchorRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const filteredRows = useMemo(() => {
    const activeFilters = Object.entries(columnFilters);
    if (!excelFilters || activeFilters.length === 0) return rows;

    return rows.filter((row) =>
      activeFilters.every(([columnKey, selectedValues]) => {
        const column = columns.find((item) => item.key === columnKey);
        if (!column) return true;
        if (selectedValues.length === 0) return false;
        const values = rowFilterValues(column, row);
        return values.some((value) => selectedValues.includes(value));
      })
    );
  }, [rows, columns, columnFilters, excelFilters]);

  const sortedRows = useMemo(() => {
    if (compareRows) {
      return [...filteredRows].sort((a, b) => compareRows(a, b, sortKey, dir));
    }
    const column = columns.find((item) => item.key === sortKey) ?? columns[0];
    if (!column) return filteredRows;
    return sortRows(filteredRows, column.value, column.kind, dir);
  }, [filteredRows, columns, sortKey, dir, compareRows]);

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const pageOffset = pageSize > 0 ? (currentPage - 1) * pageSize : 0;
  const pageRows = pageSize > 0 ? sortedRows.slice(pageOffset, pageOffset + pageSize) : sortedRows;
  useEffect(() => { setPage(1); }, [sortKey, dir, columnFilters, rows]);

  const activeFilterCount = Object.keys(columnFilters).length;

  const visibleIds = useMemo(() => sortedRows.map(rowKey), [sortedRows, rowKey]);
  const visibleAllSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds?.has(id) ?? false);
  const visibleSomeSelected =
    visibleIds.some((id) => selectedIds?.has(id) ?? false) && !visibleAllSelected;

  useEffect(() => {
    if (
      !excelFilters ||
      activeFilterCount === 0 ||
      !onReplaceSelection ||
      !selectedIds ||
      selectedIds.size === 0
    ) {
      return;
    }

    const visibleSet = new Set(filteredRows.map(rowKey));
    const next = [...selectedIds].filter((id) => visibleSet.has(id));
    if (next.length !== selectedIds.size) {
      onReplaceSelection(next);
    }
  }, [
    activeFilterCount,
    excelFilters,
    filteredRows,
    onReplaceSelection,
    rowKey,
    selectedIds
  ]);

  useEffect(() => {
    if (!openFilterKey) return;

    const handleOutside = (event: MouseEvent) => {
      if (
        filterMenuRef.current &&
        event.target instanceof Node &&
        !filterMenuRef.current.contains(event.target)
      ) {
        setOpenFilterKey(null);
        setFilterSearch("");
      }
    };

    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [openFilterKey]);

  function handleSort(key: string) {
    if (sortKey === key) {
      setDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDir("asc");
  }

  function filterOptionsFor(column: SortableColumn<T>): Array<{ value: string; count: number }> {
    const counts = new Map<string, number>();

    for (const row of rows) {
      for (const value of rowFilterValues(column, row)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) =>
        displayFilterValue(a.value).localeCompare(displayFilterValue(b.value), "ko-KR", {
          numeric: true
        })
      );
  }

  function toggleFilterValue(column: SortableColumn<T>, value: string) {
    const options = filterOptionsFor(column).map((option) => option.value);
    const currentValues = columnFilters[column.key];
    const next = new Set(currentValues ?? options);

    if (next.has(value)) next.delete(value);
    else next.add(value);

    setColumnFilters((current) => {
      const updated = { ...current };
      if (next.size === options.length) {
        delete updated[column.key];
      } else {
        updated[column.key] = [...next];
      }
      return updated;
    });
  }

  function selectAllFilterValues(columnKey: string) {
    setColumnFilters((current) => {
      const updated = { ...current };
      delete updated[columnKey];
      return updated;
    });
  }

  function clearAllFilterValues(columnKey: string) {
    setColumnFilters((current) => ({ ...current, [columnKey]: [] }));
  }

  function clearAllColumnFilters() {
    setColumnFilters({});
    setOpenFilterKey(null);
    setFilterSearch("");
  }

  function toggleVisibleRows() {
    if (!onReplaceSelection || !selectedIds) {
      onToggleAll?.();
      return;
    }

    const next = new Set(selectedIds);
    if (visibleAllSelected) {
      visibleIds.forEach((id) => next.delete(id));
    } else {
      visibleIds.forEach((id) => next.add(id));
    }
    onReplaceSelection([...next]);
  }

  const replaceSelectionWithRange = useCallback(
    (
      startIndex: number,
      endIndex: number,
      base: Set<string>,
      mode: "select" | "deselect"
    ) => {
      if (!onReplaceSelection) return;

      const next = new Set(base);
      const from = Math.max(0, Math.min(startIndex, endIndex));
      const to = Math.min(sortedRows.length - 1, Math.max(startIndex, endIndex));

      for (let index = from; index <= to; index += 1) {
        const row = sortedRows[index];
        if (!row) continue;
        const id = rowKey(row);
        if (mode === "select") next.add(id);
        else next.delete(id);
      }

      onReplaceSelection([...next]);
    },
    [onReplaceSelection, rowKey, sortedRows]
  );

  useEffect(() => {
    const stopSelectionDrag = () => {
      if (selectionDragRef.current) {
        selectionDragRef.current.active = false;
      }
    };

    window.addEventListener("mouseup", stopSelectionDrag);
    window.addEventListener("blur", stopSelectionDrag);
    return () => {
      window.removeEventListener("mouseup", stopSelectionDrag);
      window.removeEventListener("blur", stopSelectionDrag);
    };
  }, []);

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
      {excelFilters && activeFilterCount > 0 ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
          <span>
            열 필터 {activeFilterCount}개 적용 · {filteredRows.length.toLocaleString("ko-KR")}건 표시
          </span>
          <button
            type="button"
            onClick={clearAllColumnFilters}
            className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:text-slate-900"
            data-no-drag-scroll
          >
            <X size={13} />
            전체 필터 해제
          </button>
        </div>
      ) : null}

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
              "ui-table-head select-none shadow-[0_1px_0_0_rgba(226,232,240,0.9)]",
              headCellClass
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <tr>
              {selectable ? (
                <th
                  className={[
                    "sticky top-0 z-40 w-10 bg-slate-50 px-3 py-3 text-left select-none",
                    compact ? "py-2" : "",
                    stickyLeftKeys.length > 0 ? "ui-table-sticky-left-head" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={checkboxStickyStyle}
                >
                  <input
                    type="checkbox"
                    checked={onReplaceSelection ? visibleAllSelected : allSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate = onReplaceSelection
                          ? visibleSomeSelected
                          : someSelected;
                      }
                    }}
                    onChange={toggleVisibleRows}
                    aria-label="현재 표시 결과 전체 선택"
                    className="h-4 w-4 rounded border-slate-300 select-none"
                    data-no-drag-scroll
                  />
                </th>
              ) : null}
              {columns.map((column) => {
                const isActive = sortKey === column.key;
                const filterable = isFilterableColumn(column, excelFilters);
                const activeValues = columnFilters[column.key];
                const filterActive = activeValues !== undefined;
                const allOptions = filterable ? filterOptionsFor(column) : [];
                const normalizedSearch = filterSearch.trim().toLowerCase();
                const visibleOptions = normalizedSearch
                  ? allOptions.filter((option) =>
                      displayFilterValue(option.value)
                        .toLowerCase()
                        .includes(normalizedSearch)
                    )
                  : allOptions;

                return (
                  <th
                    key={column.key}
                    className={[
                      "sticky top-0 z-30 bg-slate-50",
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
                    <div
                      className={[
                        "relative inline-flex items-center gap-1",
                        column.align === "right" ? "ml-auto" : "",
                        column.align === "center" ? "mx-auto" : ""
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className={[
                          "inline-flex select-none items-center gap-1 transition hover:text-slate-800",
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

                      {filterable ? (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenFilterKey((current) =>
                              current === column.key ? null : column.key
                            );
                            setFilterSearch("");
                          }}
                          className={[
                            "relative inline-flex h-6 w-6 items-center justify-center rounded-md border transition",
                            filterActive
                              ? "border-blue-200 bg-blue-100 text-blue-700"
                              : "border-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800"
                          ].join(" ")}
                          title={`${column.label} 필터`}
                          aria-label={`${column.label} 필터`}
                          data-no-drag-scroll
                        >
                          <ListFilter size={14} strokeWidth={2.2} />
                          {filterActive ? (
                            <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-blue-600" />
                          ) : null}
                        </button>
                      ) : null}

                      {filterable && openFilterKey === column.key ? (
                        <div
                          ref={filterMenuRef}
                          className="absolute left-0 top-full z-[80] mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl"
                          data-no-drag-scroll
                          role="menu"
                        >
                          <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                            <Search size={13} className="shrink-0 text-slate-400" />
                            <input
                              value={filterSearch}
                              onChange={(event) => setFilterSearch(event.target.value)}
                              placeholder="값 검색"
                              className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none"
                              autoFocus
                              data-no-drag-scroll
                            />
                          </div>

                          <div className="mb-1 flex items-center justify-between border-b border-slate-100 pb-2">
                            <button
                              type="button"
                              onClick={() => selectAllFilterValues(column.key)}
                              className="text-[11px] font-semibold text-blue-700 hover:underline"
                              data-no-drag-scroll
                            >
                              전체 선택
                            </button>
                            <button
                              type="button"
                              onClick={() => clearAllFilterValues(column.key)}
                              className="text-[11px] font-semibold text-slate-500 hover:underline"
                              data-no-drag-scroll
                            >
                              전체 해제
                            </button>
                          </div>

                          <div className="max-h-64 overflow-y-auto py-1">
                            {visibleOptions.length === 0 ? (
                              <div className="px-2 py-4 text-center text-xs text-slate-400">
                                일치하는 값이 없습니다.
                              </div>
                            ) : (
                              visibleOptions.map((option) => {
                                const checked =
                                  activeValues === undefined ||
                                  activeValues.includes(option.value);
                                return (
                                  <label
                                    key={option.value}
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() =>
                                        toggleFilterValue(column, option.value)
                                      }
                                      className="h-3.5 w-3.5 rounded border-slate-300"
                                      data-no-drag-scroll
                                    />
                                    <span className="min-w-0 flex-1 truncate">
                                      {displayFilterValue(option.value)}
                                    </span>
                                    <span className="tabular-nums text-[10px] text-slate-400">
                                      {option.count}
                                    </span>
                                  </label>
                                );
                              })
                            )}
                          </div>

                          <div className="mt-1 flex justify-end border-t border-slate-100 pt-2">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenFilterKey(null);
                                setFilterSearch("");
                              }}
                              className="rounded-md bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
                              data-no-drag-scroll
                            >
                              완료
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 bg-white select-text">
            {sortedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  선택한 열 필터 조건에 맞는 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              pageRows.map((row, pageRowIndex) => {
                const rowIndex = pageRowIndex + pageOffset;
                const id = rowKey(row);
                const extraRowClass = getRowClassName?.(row, id);
                return (
                  <tr
                    key={id}
                    className={["ui-table-row", extraRowClass].filter(Boolean).join(" ")}
                    style={{ contentVisibility: "auto", containIntrinsicSize: "0 58px" }}
                    onMouseEnter={(event) => {
                      const state = selectionDragRef.current;
                      if (!state?.active || !onReplaceSelection) return;
                      if ((event.buttons & 1) !== 1) return;
                      replaceSelectionWithRange(
                        state.startIndex,
                        rowIndex,
                        state.base,
                        state.mode
                      );
                    }}
                  >
                    {selectable ? (
                      <td
                        className={[
                          compact ? "px-3 py-2 align-middle" : "px-3 py-3 align-top",
                          "select-none",
                          onReplaceSelection ? "cursor-pointer" : "",
                          stickyLeftKeys.length > 0 ? "ui-table-sticky-left bg-white" : ""
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={checkboxStickyStyle}
                        data-no-drag-scroll
                        onMouseDown={(event) => {
                          if (event.button !== 0 || !onReplaceSelection) return;
                          event.preventDefault();

                          if (event.shiftKey && selectionAnchorRef.current != null) {
                            replaceSelectionWithRange(
                              selectionAnchorRef.current,
                              rowIndex,
                              new Set(selectedIds ?? []),
                              "select"
                            );
                            selectionAnchorRef.current = rowIndex;
                            selectionDragRef.current = null;
                            return;
                          }

                          const mode = selectedIds?.has(id) ? "deselect" : "select";
                          const base = new Set(selectedIds ?? []);
                          selectionAnchorRef.current = rowIndex;
                          selectionDragRef.current = {
                            active: true,
                            startIndex: rowIndex,
                            mode,
                            base
                          };
                          replaceSelectionWithRange(rowIndex, rowIndex, base, mode);
                        }}
                        title={
                          onReplaceSelection
                            ? "누른 채 위/아래로 드래그하여 연속 선택 · Shift+클릭으로 구간 선택"
                            : undefined
                        }
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds?.has(id) ?? false}
                          onChange={
                            onReplaceSelection ? undefined : () => onToggleRow?.(id)
                          }
                          readOnly={Boolean(onReplaceSelection)}
                          aria-label="행 선택"
                          className={[
                            "h-4 w-4 rounded border-slate-300 select-none",
                            onReplaceSelection ? "pointer-events-none" : "cursor-pointer"
                          ].join(" ")}
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
              })
            )}
          </tbody>
        </table>
      </div>
      {pageSize > 0 && sortedRows.length > pageSize ? (
        <nav aria-label="문서 목록 페이지" className="flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-4 py-3 text-xs text-slate-600">
          <span>{pageOffset + 1}-{Math.min(pageOffset + pageSize, sortedRows.length)} / {sortedRows.length}건</span>
          <button type="button" className="rounded border px-3 py-1.5 disabled:opacity-40" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>이전</button>
          <span>{currentPage} / {pageCount}</span>
          <button type="button" className="rounded border px-3 py-1.5 disabled:opacity-40" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>다음</button>
        </nav>
      ) : null}
    </div>
  );
}
