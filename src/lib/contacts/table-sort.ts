import { comparePartnerNo } from "@/lib/partners/partner-no";
import { compareByKind, compareText, type SortDir } from "@/lib/table-sort";
import type { ContactTableRow } from "@/components/contacts/contacts-table";
import type { SortableColumn } from "@/components/common/client-sortable-table";

export function compareContactTableRows<T extends ContactTableRow>(
  a: T,
  b: T,
  sortKey: string,
  dir: SortDir,
  columns: SortableColumn<T>[]
): number {
  const direction = dir === "desc" ? -1 : 1;

  if (sortKey === "partner_no") {
    const noCmp = comparePartnerNo(a.partner_no, b.partner_no);
    if (noCmp !== 0) return noCmp * direction;

    const contractCmp =
      Number(b.is_contract_contact) - Number(a.is_contract_contact);
    if (contractCmp !== 0) return contractCmp;

    return compareText(a.name, b.name);
  }

  const column = columns.find((item) => item.key === sortKey);
  if (!column) return 0;

  return (
    compareByKind(column.value(a), column.value(b), column.kind) * direction
  );
}
