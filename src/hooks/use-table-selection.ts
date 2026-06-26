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
    toggleAll,
    clearSelection,
    allSelected,
    someSelected
  };
}
