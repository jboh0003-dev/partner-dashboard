export type PartnerDeleteMode = "partner_only" | "deactivate_contacts" | "delete_contacts";

export type PartnerDeleteImpact = {
  partner_count: number;
  company_names: string[];
  active_contact_count: number;
  document_count: number;
};
