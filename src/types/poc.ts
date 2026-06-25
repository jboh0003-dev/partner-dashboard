export type PartnerPoc = {
  id: string;
  partner_id: string;
  poc_name: string | null;
  customer_name: string | null;
  product_name: string | null;
  start_date: string | null;
  end_date: string | null;
  role_description: string | null;
  result_status: string | null;
  result_summary: string | null;
  memo: string | null;
  created_at: string;
};

export type PartnerPocWithPartner = PartnerPoc & {
  partner_name: string;
};
