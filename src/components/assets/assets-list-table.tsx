"use client";

import Link from "next/link";
import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { TableName, TableText } from "@/components/common/table-cells";
import { formatAssetUpdatedAt } from "@/lib/assets/display";
import type { AssetListRow } from "@/lib/data/assets";

const columns: SortableColumn<AssetListRow>[] = [
  {
    key: "partner_name",
    label: "파트너사",
    kind: "text",
    className: "min-w-[11rem]",
    value: (row) => row.partner_name,
    render: (row) => (
      <Link
        href={`/dashboard/partners/${row.partner_id}?tab=assets`}
        className="block min-w-[11rem] max-w-[18rem] truncate whitespace-nowrap font-semibold text-blue-700 hover:underline"
        title={row.partner_name}
      >
        {row.partner_name}
      </Link>
    )
  },
  {
    key: "partner_grade_label",
    label: "등급",
    kind: "text",
    className: "min-w-[5rem] whitespace-nowrap",
    value: (row) => row.partner_grade_label,
    render: (row) => <TableText value={row.partner_grade_label} className="min-w-[5rem] whitespace-nowrap" />
  },
  {
    key: "asset_status",
    label: "장비상태",
    kind: "text",
    className: "min-w-[6rem] whitespace-nowrap",
    value: (row) => row.asset_status,
    render: (row) => <TableText value={row.asset_status} className="min-w-[6rem] whitespace-nowrap" />
  },
  {
    key: "node_name",
    label: "노드명",
    kind: "text",
    className: "min-w-[9rem]",
    value: (row) => row.node_name,
    render: (row) => (
      <TableName title={row.node_name ?? undefined}>
        {row.node_name ?? "-"}
      </TableName>
    )
  },
  {
    key: "cpu",
    label: "CPU",
    kind: "text",
    className: "min-w-[8rem]",
    value: (row) => row.cpu,
    render: (row) => <TableText value={row.cpu} className="block min-w-[8rem] max-w-[18rem] break-keep whitespace-normal" />
  },
  {
    key: "memory",
    label: "Memory",
    kind: "text",
    className: "min-w-[7rem]",
    value: (row) => row.memory,
    render: (row) => <TableText value={row.memory} className="block min-w-[7rem] max-w-[14rem] break-keep whitespace-normal" />
  },
  {
    key: "os_disk",
    label: "OS Disk",
    kind: "text",
    className: "min-w-[8rem]",
    value: (row) => row.os_disk,
    render: (row) => <TableText value={row.os_disk} className="block min-w-[8rem] max-w-[16rem] break-keep whitespace-normal" />
  },
  {
    key: "ceph_disk",
    label: "Ceph Disk",
    kind: "text",
    className: "min-w-[8rem]",
    value: (row) => row.ceph_disk,
    render: (row) => <TableText value={row.ceph_disk} className="block min-w-[8rem] max-w-[16rem] break-keep whitespace-normal" />
  },
  {
    key: "nic",
    label: "NIC",
    kind: "text",
    className: "min-w-[7rem]",
    value: (row) => row.nic,
    render: (row) => <TableText value={row.nic} className="block min-w-[7rem] max-w-[14rem] break-keep whitespace-normal" />
  },
  {
    key: "updated_at",
    label: "최종 업데이트",
    kind: "date",
    className: "min-w-[7rem] whitespace-nowrap",
    value: (row) => row.updated_at ?? row.last_synced_at,
    render: (row) => (
      <span className="whitespace-nowrap">{formatAssetUpdatedAt(row)}</span>
    )
  }
];

export function AssetsListTable({ rows }: { rows: AssetListRow[] }) {
  return (
    <ClientSortableTable
      rows={rows}
      columns={columns}
      defaultSortKey="partner_name"
      defaultDir="asc"
      minWidth="1680px"
      rowKey={(row) => row.id}
    />
  );
}
