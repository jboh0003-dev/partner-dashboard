"use client";

import { type SortableColumn } from "@/components/common/client-sortable-table";
import { CopyableDataTable } from "@/components/common/copyable-data-table";
import { TableClamp2, TableName, TableNowrap } from "@/components/common/table-cells";
import { formatTrainingTypeLabel } from "@/lib/training/constants";
import {
  formatAttendanceStatus,
  formatTrainingYearMonth
} from "@/lib/training-display";
import {
  TRAINING_ATTENDEE_SELECTED_ROW_TSV,
  trainingAttendeeRowToCopyable
} from "@/lib/clipboard/row-mappers";
import type { CsvRow } from "@/lib/csv";

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
    className: "min-w-[140px]",
    value: (row) => row.partner_name,
    render: (row) => (
      <TableName title={row.partner_name} className="min-w-[140px] max-w-[200px]">
        {row.partner_name}
      </TableName>
    )
  },
  {
    key: "attendee_name",
    label: "이름",
    kind: "text",
    className: "min-w-[80px]",
    value: (row) => row.attendee_name,
    render: (row) => <TableNowrap value={row.attendee_name} className="min-w-[80px]" />
  },
  {
    key: "training_year_month",
    label: "교육연월",
    kind: "text",
    className: "min-w-[90px]",
    value: (row) =>
      row.training_year && row.training_month
        ? `${row.training_year}-${String(row.training_month).padStart(2, "0")}`
        : null,
    render: (row) => (
      <TableNowrap
        value={formatTrainingYearMonth(row.training_year, row.training_month)}
        className="min-w-[90px] tabular-nums"
      />
    )
  },
  {
    key: "training_type",
    label: "교육구분",
    kind: "text",
    className: "min-w-[100px]",
    value: (row) => row.training_type,
    render: (row) => (
      <TableNowrap
        value={formatTrainingTypeLabel(row.training_type)}
        className="min-w-[100px]"
      />
    )
  },
  {
    key: "training_name",
    label: "교육명",
    kind: "text",
    className: "min-w-[220px]",
    value: (row) => row.training_name,
    render: (row) => (
      <TableClamp2
        value={row.training_name}
        className="min-w-[220px] max-w-[280px]"
      />
    )
  },
  {
    key: "attendee_position",
    label: "직급",
    kind: "text",
    className: "min-w-[80px]",
    value: (row) => row.attendee_position,
    render: (row) => <TableNowrap value={row.attendee_position} className="min-w-[80px]" />
  },
  {
    key: "attendee_department",
    label: "직무",
    kind: "text",
    className: "min-w-[80px]",
    value: (row) => row.attendee_department,
    render: (row) => <TableNowrap value={row.attendee_department} className="min-w-[80px]" />
  },
  {
    key: "attendee_phone",
    label: "휴대폰",
    kind: "text",
    className: "min-w-[120px]",
    value: (row) => row.attendee_phone,
    render: (row) => (
      <TableNowrap value={row.attendee_phone} className="min-w-[120px] tabular-nums" />
    )
  },
  {
    key: "attendee_email",
    label: "이메일",
    kind: "text",
    className: "min-w-[180px]",
    value: (row) => row.attendee_email,
    render: (row) => (
      <TableNowrap value={row.attendee_email} className="min-w-[180px] max-w-[240px]" />
    )
  },
  {
    key: "attendance_status",
    label: "참석상태",
    kind: "text",
    className: "min-w-[80px]",
    value: (row) => formatAttendanceStatus(row.attended, row.attendance_status),
    render: (row) => (
      <TableNowrap
        value={formatAttendanceStatus(row.attended, row.attendance_status)}
        className="min-w-[80px]"
      />
    )
  },
  {
    key: "completion_status",
    label: "수료여부",
    kind: "text",
    className: "min-w-[80px]",
    value: (row) => row.completion_status,
    render: (row) => <TableNowrap value={row.completion_status} className="min-w-[80px]" />
  },
  {
    key: "score",
    label: "점수",
    kind: "number",
    align: "right",
    className: "min-w-[70px]",
    value: (row) => row.score,
    render: (row) => (
      <TableNowrap
        value={row.score != null ? String(row.score) : null}
        className="min-w-[70px] text-right tabular-nums"
      />
    )
  },
  {
    key: "evaluation_result",
    label: "평가결과",
    kind: "text",
    className: "min-w-[80px]",
    value: (row) => row.evaluation_result,
    render: (row) => <TableNowrap value={row.evaluation_result} className="min-w-[80px]" />
  },
  {
    key: "note",
    label: "비고",
    kind: "text",
    className: "min-w-[160px]",
    value: (row) => row.note,
    render: (row) => (
      <TableClamp2 value={row.note} className="min-w-[160px] max-w-[220px]" />
    )
  }
];

export function TrainingAttendeesTable({
  rows,
  csvRows
}: {
  rows: TrainingAttendeeRow[];
  csvRows?: CsvRow[];
}) {
  return (
    <CopyableDataTable
      rows={rows}
      columns={columns}
      defaultSortKey="training_year_month"
      defaultDir="desc"
      minWidth="1520px"
      rowKey={(row) => row.id}
      toCopyableRow={trainingAttendeeRowToCopyable}
      selectedRowTsv={TRAINING_ATTENDEE_SELECTED_ROW_TSV}
      csvRows={csvRows}
      csvFilenamePrefix="training-attendees"
      scrollable
      scrollMaxHeight="calc(100vh - 360px)"
    />
  );
}
