export type PartnerStatus = "active" | "inactive" | "pending" | "expired" | "blocked";

export type Partner = {
  id: string;
  external_no: string | null;
  company_name: string;
  business_number: string | null;
  grade: string | null;
  grade_raw: string | null;
  status: PartnerStatus;
  ceo_name: string | null;
  address: string | null;
  website: string | null;
  main_phone: string | null;
  primary_email: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  sales_owner: string | null;
  okestro_owner: string | null;
  contract_contact_name: string | null;
  contract_contact_phone: string | null;
  contract_contact_email: string | null;
  revenue_2023: string | null;
  employee_count: string | null;
  credit_rating: string | null;
  region_group: string | null;
  region: string | null;
  city: string | null;
  source_file: string | null;
  last_synced_at: string | null;
  memo: string | null;
  has_training: boolean;
  theory_only: boolean;
  has_sales_opportunity: boolean;
  data_quality_warning: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerContact = {
  id: string;
  partner_id: string;
  name: string;
  department: string | null;
  position: string | null;
  role_type: string | null;
  role_raw: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_contract_contact: boolean;
  source_file: string | null;
  last_synced_at: string | null;
  memo: string | null;
  created_at: string;
};

export type PartnerNote = {
  id: string;
  partner_id: string;
  note_type: string | null;
  title: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
};

export type PartnerTrainingMonthly = {
  id: string;
  partner_id: string;
  training_year: number;
  training_month: number;
  training_label: string | null;
  attended: boolean;
  raw_value: string | null;
  created_at: string;
};
