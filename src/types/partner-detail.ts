import type { PartnerAsset } from "@/types/asset";
import type { PartnerDocument } from "@/types/document";
import type { PartnerPoc } from "@/types/poc";
import type {
  Partner,
  PartnerContact,
  PartnerNote,
  PartnerTrainingMonthly
} from "@/types/partner";

/** 파트너 상세 — 교육 참석 이력 (training_attendance × trainings) */
export type PartnerTrainingHistoryItem = {
  id: string;
  training_id: string;
  training_name: string;
  training_type: string | null;
  product_name: string | null;
  start_date: string | null;
  end_date: string | null;
  attendee_name: string | null;
  attendee_department: string | null;
  attendee_position: string | null;
  attended: boolean;
  score: number | null;
  converted_score: number | null;
  rank: number | null;
  exam_status: string | null;
  attendance_days: number | null;
  partial_days: number | null;
  absent_days: number | null;
  evaluation_result: string | null;
  extra_json: Record<string, unknown> | null;
};

export type PartnerTrainingSessionGroup = {
  training_id: string;
  training_name: string;
  training_type: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  is_tech_partner: boolean;
  participants: PartnerTrainingHistoryItem[];
  attendee_count: number;
  exam_taken_count: number;
  avg_total_score: number | null;
  avg_converted_score: number | null;
};

/** 파트너 상세 — 행사 이력 (partner_event_partners × partner_events) */
export type PartnerEventHistoryItem = {
  id: string;
  event_id: string;
  event_name: string;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  relation_type: string | null;
  document_count: number;
  source: "manual" | "attendance";
  attendee_name?: string | null;
  attendee_department?: string | null;
  attendee_position?: string | null;
  attended?: boolean;
};

/** AI 에이전트/상세 UI 가 공통으로 사용할 파트너 상세 데이터 묶음 */
export type PartnerDetailBundle = {
  partner: Partner;
  contacts: PartnerContact[];
  inactiveContacts: PartnerContact[];
  notes: PartnerNote[];
  trainings: PartnerTrainingHistoryItem[];
  trainingSessions: PartnerTrainingSessionGroup[];
  monthlyTrainings: PartnerTrainingMonthly[];
  events: PartnerEventHistoryItem[];
  pocs: PartnerPoc[];
  assets: PartnerAsset[];
  documents: PartnerDocument[];
  performance: PartnerPerformanceBundle;
};

export type PartnerPerformanceBundle = {
  snapshot: { snapshot_date: string; snapshot_label: string } | null;
  win_forecast_amount_million: number;
  win_forecast_count: number;
  new_reg_amount_million: number;
  new_reg_count: number;
  revenue_amount_million: number;
  revenue_count: number;
  opportunities: import("@/types/partner-performance").PartnerPipelineOpportunity[];
  win_probability_breakdown: Array<{ label: string; amount_million: number; count: number }>;
};
