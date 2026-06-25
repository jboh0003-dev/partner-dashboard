import { CONTACT_ROLE_LABEL } from "@/lib/constants";

export type ContactAssignmentInput = {
  role_type: string | null;
  role_raw?: string | null;
  is_contract_contact: boolean;
};

/** 화면에 표시할 담당구분 문구 */
export function getContactAssignmentLabel(contact: ContactAssignmentInput): string {
  if (contact.is_contract_contact) return "계약담당자";

  const role = contact.role_type ?? "etc";
  if (role === "etc") {
    return contact.role_raw?.trim() || "일반 담당자";
  }

  return CONTACT_ROLE_LABEL[role] ?? "일반 담당자";
}

export type ContactAssignmentTone = "contract" | "sales" | "engineer" | "executive" | "admin" | "default";

export function getContactAssignmentTone(contact: ContactAssignmentInput): ContactAssignmentTone {
  if (contact.is_contract_contact) return "contract";

  switch (contact.role_type) {
    case "sales":
      return "sales";
    case "engineer":
      return "engineer";
    case "executive":
      return "executive";
    case "admin":
      return "admin";
    default:
      return "default";
  }
}

export const CONTACT_ASSIGNMENT_TONE_CLASS: Record<ContactAssignmentTone, string> = {
  contract: "bg-amber-100 text-amber-800 ring-amber-200",
  sales: "bg-blue-50 text-blue-800 ring-blue-100",
  engineer: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  executive: "bg-violet-50 text-violet-800 ring-violet-100",
  admin: "bg-slate-100 text-slate-700 ring-slate-200",
  default: "bg-slate-50 text-slate-600 ring-slate-200"
};
