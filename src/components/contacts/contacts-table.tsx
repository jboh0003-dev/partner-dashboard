"use client";

import Link from "next/link";
import {
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { CopyableDataTable } from "@/components/common/copyable-data-table";
import { TableName, TableText } from "@/components/common/table-cells";
import { ContactAssignmentBadge } from "@/components/contacts/contact-assignment-badge";
import { getContactAssignmentLabel } from "@/lib/contacts/display";
import {
  CONTACT_SELECTED_ROW_TSV,
  contactRowToCopyable
} from "@/lib/clipboard/row-mappers";
import type { CsvRow } from "@/lib/csv";

export type ContactTableRow = {
  id: string;
  partner_id: string;
  name: string;
  company_name: string;
  role_type: string | null;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  is_contract_contact: boolean;
};

const columns: SortableColumn<ContactTableRow>[] = [
  {
    key: "company_name",
    label: "회사명",
    kind: "text",
    className: "min-w-[11rem]",
    value: (row) => row.company_name,
    render: (row) => <TableName title={row.company_name}>{row.company_name}</TableName>
  },
  {
    key: "name",
    label: "이름",
    kind: "text",
    className: "min-w-[6rem] whitespace-nowrap",
    value: (row) => row.name,
    render: (row) => <TableText value={row.name} className="min-w-[6rem] whitespace-nowrap" />
  },
  {
    key: "assignment",
    label: "담당구분",
    kind: "text",
    className: "min-w-[7rem]",
    value: (row) =>
      getContactAssignmentLabel({
        role_type: row.role_type,
        is_contract_contact: row.is_contract_contact
      }),
    render: (row) => (
      <ContactAssignmentBadge
        contact={{
          role_type: row.role_type,
          is_contract_contact: row.is_contract_contact
        }}
      />
    )
  },
  {
    key: "department",
    label: "부서/직급",
    kind: "text",
    value: (row) => [row.department, row.position].filter(Boolean).join(" / "),
    render: (row) => (
      <TableText
        value={[row.department, row.position].filter(Boolean).join(" / ")}
        className="block min-w-[8rem] max-w-[16rem] break-keep whitespace-normal"
      />
    )
  },
  {
    key: "phone",
    label: "연락처",
    kind: "text",
    className: "min-w-[8rem] whitespace-nowrap",
    value: (row) => row.phone,
    render: (row) => <TableText value={row.phone} className="min-w-[8rem] whitespace-nowrap" />
  },
  {
    key: "email",
    label: "이메일",
    kind: "text",
    className: "min-w-[10rem]",
    value: (row) => row.email,
    render: (row) => (
      <TableText
        value={row.email}
        className="block min-w-[10rem] max-w-[18rem] break-keep whitespace-normal"
      />
    )
  },
  {
    key: "detail",
    label: "상세",
    kind: "text",
    align: "right",
    value: () => "",
    render: (row) => (
      <Link
        href={`/dashboard/partners/${row.partner_id}`}
        className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-700"
      >
        보기
      </Link>
    )
  }
];

export function ContactsTable({
  rows,
  csvRows
}: {
  rows: ContactTableRow[];
  csvRows?: CsvRow[];
}) {
  return (
    <CopyableDataTable
      rows={rows}
      columns={columns}
      defaultSortKey="company_name"
      defaultDir="asc"
      minWidth="1050px"
      rowKey={(row) => row.id}
      toCopyableRow={contactRowToCopyable}
      selectedRowTsv={CONTACT_SELECTED_ROW_TSV}
      csvRows={csvRows}
      csvFilenamePrefix="partner-contacts"
    />
  );
}
