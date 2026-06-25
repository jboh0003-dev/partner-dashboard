"use client";

import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { TableName, TableText } from "@/components/common/table-cells";
import { formatTrainingTypeLabel } from "@/lib/training/constants";
import {
  formatAttendanceStatus,
  formatTrainingYearMonth
} from "@/lib/training-display";

export type TrainingAttendeeRow = {
  id: string;
  partner_name: string;
  attendee_name: string;
  training_year: number | null;
  training_month: number | null;
  training_type: string | null;
  training_name: string;
  attendee_position: string | null;
  attendee_department: string | null;
  attendee_phone: string | null;
  attendee_email: string | null;
  attended: boolean;
  attendance_status: string | null;
  completion_status: string | null;
  score: number | null;
  evaluation_result: string | null;
  note: string | null;
};

const columns: SortableColumn<TrainingAttendeeRow>[] = [
  {
    key: "partner_name",
    label: "파트너사",
    kind: "text",
    className: "min-w-[11rem]",
    value: (row) => row.partner_name,
    render: (row) => <TableName title={row.partner_name}>{row.partner_name}</TableName>
  },
  {
    key: "attendee_name",
    label: "이름",
    kind: "text",
    className: "min-w-[6rem] whitespace-nowrap",
    value: (row) => row.attendee_name,
    render: (row) => <TableText value={row.attendee_name} className="min-w-[6rem] whitespace-nowrap" />
  },
  {
    key: "training_year_month",
    label: "교육연월",
    kind: "text",
    value: (row) =>
      row.training_year && row.training_month
        ? `${row.training_year}-${String(row.training_month).padStart(2, "0")}`
        : null,
    render: (row) => formatTrainingYearMonth(row.training_year, row.training_month)
  },
  {
    key: "training_type",
    label: "교육구분",
    kind: "text",
    value: (row) => row.training_type,
    render: (row) => formatTrainingTypeLabel(row.training_type)
  },
  {
    key: "training_name",
    label: "교육명",
    kind: "text",
    className: "min-w-[10rem]",
    value: (row) => row.training_name,
    render: (row) => (
      <TableText value={row.training_name} className="block min-w-[10rem] max-w-[18rem] break-keep whitespace-normal" />
    )
  },
  {
    key: "attendee_position",
    label: "직급",
    kind: "text",
    value: (row) => row.attendee_position,
    render: (row) => row.attendee_position ?? "-"
  },
  {
    key: "attendee_department",
    label: "직무",
    kind: "text",
    value: (row) => row.attendee_department,
    render: (row) => row.attendee_department ?? "-"
  },
  {
    key: "attendee_phone",
    label: "휴대폰",
    kind: "text",
    value: (row) => row.attendee_phone,
    render: (row) => row.attendee_phone ?? "-"
  },
  {
    key: "attendee_email",
    label: "이메일",
    kind: "text",
    value: (row) => row.attendee_email,
    render: (row) => (
      <TableText
        value={row.attendee_email}
        className="block min-w-[10rem] max-w-[18rem] break-keep whitespace-normal"
      />
    )
  },
  {
    key: "attendance_status",
    label: "참석상태",
    kind: "text",
    value: (row) => formatAttendanceStatus(row.attended, row.attendance_status),
    render: (row) => formatAttendanceStatus(row.attended, row.attendance_status)
  },
  {
    key: "completion_status",
    label: "수료여부",
    kind: "text",
    value: (row) => row.completion_status,
    render: (row) => row.completion_status ?? "-"
  },
  {
    key: "score",
    label: "점수",
    kind: "number",
    align: "right",
    value: (row) => row.score,
    render: (row) => (row.score != null ? row.score : "-")
  },
  {
    key: "evaluation_result",
    label: "평가결과",
    kind: "text",
    value: (row) => row.evaluation_result,
    render: (row) => row.evaluation_result ?? "-"
  },
  {
    key: "note",
    label: "비고",
    kind: "text",
    value: (row) => row.note,
    render: (row) => (
      <TableText value={row.note} className="block min-w-[8rem] max-w-[16rem] break-keep whitespace-normal" />
    )
  }
];

export function TrainingAttendeesTable({ rows }: { rows: TrainingAttendeeRow[] }) {
  return (
    <ClientSortableTable
      rows={rows}
      columns={columns}
      defaultSortKey="training_year_month"
      defaultDir="desc"
      minWidth="1680px"
      rowKey={(row) => row.id}
    />
  );
}
