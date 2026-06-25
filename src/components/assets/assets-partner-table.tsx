"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AssetNodeDetailTable } from "@/components/assets/asset-node-card";
import { Badge } from "@/components/ui/badge";
import type { AssetPartnerSummary } from "@/lib/assets/aggregate";
import { formatAssetUpdatedAt } from "@/lib/assets/display";
import { sortRows, type SortDir } from "@/lib/table-sort";

type AssetsPartnerTableProps = {
  rows: AssetPartnerSummary[];
};

type SortKey =
  | "partner_name"
  | "partner_grade_label"
  | "asset_status"
  | "config_summary"
  | "latest_updated_at";

const SORT_COLUMNS: Array<{
  key: SortKey;
  label: string;
  value: (row: AssetPartnerSummary) => string | number | null | undefined;
  kind: "text" | "date";
  minWidth?: string;
}> = [
  { key: "partner_name", label: "파트너사", value: (row) => row.partner_name, kind: "text", minWidth: "11rem" },
  { key: "partner_grade_label", label: "등급", value: (row) => row.partner_grade_label, kind: "text", minWidth: "5rem" },
  { key: "asset_status", label: "장비상태", value: (row) => row.asset_status, kind: "text", minWidth: "6rem" },
  {
    key: "config_summary",
    label: "구성 요약",
    value: (row) => `${row.control_node_label} / ${row.compute_node_label}`,
    kind: "text",
    minWidth: "12rem"
  },
  { key: "latest_updated_at", label: "최종 업데이트", value: (row) => row.latest_updated_at, kind: "date", minWidth: "7rem" }
];

function buildConfigSummary(row: AssetPartnerSummary): string {
  return [row.control_node_label, row.compute_node_label].filter(Boolean).join(" · ");
}

export function AssetsPartnerTable({ rows }: AssetsPartnerTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("partner_name");
  const [dir, setDir] = useState<SortDir>("asc");
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);

  const sortedRows = useMemo(() => {
    const column = SORT_COLUMNS.find((item) => item.key === sortKey) ?? SORT_COLUMNS[0];
    return sortRows(rows, column.value, column.kind, dir);
  }, [rows, sortKey, dir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDir("asc");
  }

  const columnCount = SORT_COLUMNS.length + 2;

  return (
    <div className="ui-table-shell">
      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full divide-y divide-slate-100">
          <thead className="ui-table-head">
            <tr>
              <th className="w-10 px-3 py-3" aria-label="펼치기" />
              {SORT_COLUMNS.map((column) => {
                const isActive = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    className="px-4 py-3 text-left"
                    style={column.minWidth ? { minWidth: column.minWidth } : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={[
                        "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-slate-800",
                        isActive ? "text-okestro-700" : "text-slate-500"
                      ].join(" ")}
                    >
                      <span>{column.label}</span>
                      <span className="text-[10px] text-okestro-600">
                        {isActive ? (dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                상세
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sortedRows.map((row) => {
              const expanded = expandedPartnerId === row.partner_id;
              return (
                <PartnerRows
                  key={row.partner_id}
                  row={row}
                  expanded={expanded}
                  columnCount={columnCount}
                  onToggle={() =>
                    setExpandedPartnerId((current) =>
                      current === row.partner_id ? null : row.partner_id
                    )
                  }
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PartnerRows({
  row,
  expanded,
  columnCount,
  onToggle
}: {
  row: AssetPartnerSummary;
  expanded: boolean;
  columnCount: number;
  onToggle: () => void;
}) {
  const updatedLabel = row.latest_updated_at
    ? formatAssetUpdatedAt({
        last_synced_at: row.latest_updated_at,
        updated_at: row.latest_updated_at,
        created_at: row.latest_updated_at
      })
    : "-";

  return (
    <>
      <tr className="ui-table-row">
        <td className="px-3 py-3.5 align-top">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-expanded={expanded}
            aria-label={`${row.partner_name} 노드 상세 ${expanded ? "접기" : "펼치기"}`}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="ui-table-cell">
          <Link
            href={`/dashboard/partners/${row.partner_id}?tab=assets`}
            className="block max-w-[18rem] truncate font-semibold text-okestro-600 hover:underline"
            title={row.partner_name}
          >
            {row.partner_name}
          </Link>
        </td>
        <td className="ui-table-cell whitespace-nowrap">{row.partner_grade_label}</td>
        <td className="ui-table-cell whitespace-nowrap">
          {row.asset_status ? <Badge tone="primary">{row.asset_status}</Badge> : "-"}
        </td>
        <td className="ui-table-cell text-slate-600">{buildConfigSummary(row)}</td>
        <td className="ui-table-cell whitespace-nowrap tabular-nums text-slate-500">
          {updatedLabel}
        </td>
        <td className="ui-table-cell text-right">
          <button type="button" onClick={onToggle} className="ui-btn-secondary px-3 py-1.5 text-xs">
            {expanded ? "접기" : "노드 상세"}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-slate-50/60">
          <td colSpan={columnCount} className="px-4 py-4">
            <AssetNodeDetailTable assets={row.nodes} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
