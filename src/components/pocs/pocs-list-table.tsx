"use client";

import Link from "next/link";
import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { TableText } from "@/components/common/table-cells";
import { POC_RESULT_STATUS_LABEL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export type PocListRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  poc_name: string | null;
  customer_name: string | null;
  product_name: string | null;
  start_date: string | null;
  end_date: string | null;
  result_status: string | null;
  result_summary: string | null;
  memo: string | null;
};

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "-";
  if (start && end && start !== end) {
    return `${formatDate(start)} ~ ${formatDate(end)}`;
  }
  return formatDate(start ?? end);
}

const columns: SortableColumn<PocListRow>[] = [
  {
    key: "partner_name",
    label: "파트너사",
    kind: "text",
    className: "min-w-[11rem]",
    value: (row) => row.partner_name,
    render: (row) => (
      <Link
        href={`/dashboard/partners/${row.partner_id}`}
        className="block min-w-[11rem] max-w-[18rem] truncate whitespace-nowrap font-semibold text-blue-700 hover:underline"
        title={row.partner_name}
      >
        {row.partner_name}
      </Link>
    )
  },
  {
    key: "poc_name",
    label: "PoC명",
    kind: "text",
    className: "min-w-[10rem]",
    value: (row) => row.poc_name,
    render: (row) => (
      <TableText
        value={row.poc_name}
        className="block min-w-[10rem] max-w-[18rem] break-keep whitespace-normal font-medium text-slate-900"
      />
    )
  },
  {
    key: "customer_name",
    label: "고객사",
    kind: "text",
    className: "min-w-[8rem]",
    value: (row) => row.customer_name,
    render: (row) => (
      <TableText value={row.customer_name} className="block min-w-[8rem] max-w-[14rem] break-keep whitespace-normal" />
    )
  },
  {
    key: "product_name",
    label: "제품",
    kind: "text",
    className: "min-w-[8rem]",
    value: (row) => row.product_name,
    render: (row) => (
      <TableText value={row.product_name} className="block min-w-[8rem] max-w-[14rem] break-keep whitespace-normal" />
    )
  },
  {
    key: "start_date",
    label: "기간",
    kind: "date",
    value: (row) => row.start_date ?? row.end_date,
    render: (row) => formatPeriod(row.start_date, row.end_date)
  },
  {
    key: "result_status",
    label: "결과",
    kind: "text",
    value: (row) => row.result_status,
    render: (row) =>
      row.result_status
        ? POC_RESULT_STATUS_LABEL[row.result_status] ?? row.result_status
        : "-"
  },
  {
    key: "result_summary",
    label: "요약",
    kind: "text",
    value: (row) => row.result_summary ?? row.memo,
    render: (row) => (
      <TableText
        value={row.result_summary ?? row.memo}
        className="block min-w-[12rem] max-w-[24rem] break-keep whitespace-normal"
      />
    )
  }
];

export function PocsListTable({ rows }: { rows: PocListRow[] }) {
  return (
    <ClientSortableTable
      rows={rows}
      columns={columns}
      defaultSortKey="start_date"
      defaultDir="desc"
      minWidth="1300px"
      rowKey={(row) => row.id}
    />
  );
}
