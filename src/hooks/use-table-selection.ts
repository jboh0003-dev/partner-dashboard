"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export function useTableSelection<T>(
  rows: T[],
  rowKey: (row: T) => string
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const rowIds = useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const rowIdSet = useMemo(() => new Set(rowIds), [rowIds]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => rowIdSet.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [rowIdSet]);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const replaceSelection = useCallback(
    (ids: Iterable<string>) => {
      const next = new Set<string>();
      for (const id of ids) {
        if (rowIdSet.has(id)) next.add(id);
      }
      setSelectedIds(next);
    },
    [rowIdSet]
  );

  const setRowsSelected = useCallback(
    (ids: Iterable<string>, selected: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (!rowIdSet.has(id)) continue;
          if (selected) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [rowIdSet]
  );

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (rowIds.length > 0 && prev.size === rowIds.length) {
        return new Set();
      }
      return new Set(rowIds);
    });
  }, [rowIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = rowIds.length > 0 && selectedIds.size === rowIds.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleRow,
    replaceSelection,
    setRowsSelected,
    toggleAll,
    clearSelection,
    allSelected,
    someSelected
  };
}
