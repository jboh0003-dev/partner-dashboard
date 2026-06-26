"use client";

import Link from "next/link";
import { type SortableColumn } from "@/components/common/client-sortable-table";
import { CopyableDataTable } from "@/components/common/copyable-data-table";
import { TableText } from "@/components/common/table-cells";
import { PARTNER_GRADE_LABEL } from "@/lib/constants";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import type { PartnerListRow } from "@/lib/partners/list";
import { formatDate } from "@/lib/utils";
import {
  PARTNER_SELECTED_ROW_TSV,
  partnerRowToCopyable
} from "@/lib/clipboard/row-mappers";
import type { CsvRow } from "@/lib/csv";

type PartnerTableProps = {
  rows: PartnerListRow[];
  csvRows?: CsvRow[];
};

const columns: SortableColumn<PartnerListRow>[] = [
  {
    key: "external_no",
    label: "번호",
    kind: "partner_no",
    value: (row) => row.partner.external_no,
    render: (row) => (
      <span className="tabular-nums text-slate-700">{formatPartnerNo(row.partner)}</span>
    )
  },
  {
    key: "company_name",
    label: "회사명",
    kind: "text",
    className: "min-w-[11rem]",
    value: (row) => row.partner.company_name,
    render: (row) => (
      <Link
        href={`/dashboard/partners/${row.partner.id}`}
        title={row.partner.company_name}
        className="block min-w-[11rem] max-w-[18rem] truncate whitespace-nowrap font-semibold text-blue-700 transition hover:text-blue-900 hover:underline"
      >
        {row.partner.company_name}
      </Link>
    )
  },
  {
    key: "grade",
    label: "등급",
    kind: "grade",
    value: (row) => row.partner.grade,
    render: (row) =>
      PARTNER_GRADE_LABEL[row.partner.grade ?? "none"] ?? row.partner.grade ?? "-"
  },
  {
    key: "contract_start_date",
    label: "계약일자",
    kind: "date",
    value: (row) => row.partner.contract_start_date,
    render: (row) =>
      row.partner.contract_start_date ? formatDate(row.partner.contract_start_date) : "-"
  },
  {
    key: "contact_name",
    label: "담당자명",
    kind: "text",
    value: (row) => row.contactName,
    render: (row) => row.contactName ?? "-"
  },
  {
    key: "contact_position",
    label: "직급",
    kind: "text",
    value: (row) => row.contactPosition,
    render: (row) => row.contactPosition ?? "-"
  },
  {
    key: "contact_phone",
    label: "연락처",
    kind: "text",
    value: (row) => row.contactPhone,
    render: (row) => row.contactPhone ?? "-"
  },
  {
    key: "contact_email",
    label: "이메일",
    kind: "text",
    value: (row) => row.contactEmail,
    render: (row) => (
      <TableText
        value={row.contactEmail}
        className="block min-w-[10rem] max-w-[18rem] break-keep whitespace-normal"
      />
    )
  }
];

export function PartnerTable({ rows, csvRows }: PartnerTableProps) {
  return (
    <CopyableDataTable
      rows={rows}
      columns={columns}
      defaultSortKey="external_no"
      defaultDir="asc"
      minWidth="1200px"
      rowKey={(row) => row.partner.id}
      toCopyableRow={partnerRowToCopyable}
      selectedRowTsv={PARTNER_SELECTED_ROW_TSV}
      csvRows={csvRows}
      csvFilenamePrefix="partners"
    />
  );
}
