"use client";

import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { formatDate } from "@/lib/utils";

export type EventListRow = {
  id: string;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  memo: string | null;
  attendance_count: number;
  attended_count: number;
  partner_count: number;
};

const columns: SortableColumn<EventListRow>[] = [
  {
    key: "event_name",
    label: "행사명",
    kind: "text",
    className: "min-w-[12rem]",
    value: (row) => row.event_name,
    render: (row) => (
      <div className="min-w-[12rem] max-w-[20rem]">
        <div className="break-keep font-semibold text-slate-900" title={row.event_name}>
          {row.event_name}
        </div>
        {row.memo ? (
          <div className="mt-0.5 break-keep text-xs text-slate-400" title={row.memo}>
            {row.memo}
          </div>
        ) : null}
      </div>
    )
  },
  {
    key: "event_type",
    label: "유형",
    kind: "text",
    value: (row) => row.event_type,
    render: (row) => row.event_type ?? "-"
  },
  {
    key: "event_date",
    label: "일자",
    kind: "date",
    value: (row) => row.event_date,
    render: (row) => (row.event_date ? formatDate(row.event_date) : "-")
  },
  {
    key: "location",
    label: "장소",
    kind: "text",
    value: (row) => row.location,
    render: (row) => row.location ?? "-"
  },
  {
    key: "attendance_count",
    label: "등록",
    kind: "number",
    align: "right",
    value: (row) => row.attendance_count,
    render: (row) => row.attendance_count.toLocaleString("ko-KR")
  },
  {
    key: "attended_count",
    label: "참석",
    kind: "number",
    align: "right",
    value: (row) => row.attended_count,
    render: (row) => (
      <span className="font-semibold text-blue-700">
        {row.attended_count.toLocaleString("ko-KR")}
      </span>
    )
  },
  {
    key: "partner_count",
    label: "파트너사",
    kind: "number",
    align: "right",
    value: (row) => row.partner_count,
    render: (row) => row.partner_count.toLocaleString("ko-KR")
  }
];

export function EventsListTable({ rows }: { rows: EventListRow[] }) {
  return (
    <ClientSortableTable
      rows={rows}
      columns={columns}
      defaultSortKey="event_date"
      defaultDir="desc"
      minWidth="1000px"
      rowKey={(row) => row.id}
    />
  );
}
