export const EVENT_PARTNER_RELATION_TYPES = [
  "참석",
  "초청",
  "관련",
  "발표",
  "후원",
  "기타"
] as const;

export type EventPartnerRelationType = (typeof EVENT_PARTNER_RELATION_TYPES)[number];

export type EventPartnerLinkRecord = {
  id: string;
  event_id: string;
  partner_id: string;
  relation_type: string;
  source: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type EventPartnerLinkWithPartner = EventPartnerLinkRecord & {
  partner: {
    id: string;
    company_name: string;
    grade: string | null;
  };
};

export type PartnerLinkedEventItem = {
  id: string;
  event_id: string;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  relation_type: string;
  source: string;
  document_count: number;
};
