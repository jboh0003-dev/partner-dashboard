import { z } from "zod";

const ParticipantSchema = z.object({
  key: z.string(),
  company_name: z.string(),
  participant_name: z.string(),
  title: z.string().nullable().optional(),
  group_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  in_roster: z.boolean(),
  in_exam: z.boolean(),
  education_status: z.string().optional(),
  has_any_attendance_record: z.boolean().optional(),
  no_show: z.boolean().optional(),
  needs_review: z.boolean().optional(),
  attendance_days: z.number().nullable().optional(),
  partial_days: z.number().nullable().optional(),
  absent_days: z.number().nullable().optional(),
  attendance_rate: z.number().nullable().optional(),
  daily_attendance: z.record(z.string(), z.string()).nullable().optional(),
  rank: z.number().nullable().optional(),
  total_score: z.number().nullable().optional(),
  converted_score: z.number().nullable().optional(),
  solution_understanding_score: z.number().nullable().optional(),
  technical_test_score: z.number().nullable().optional(),
  advanced_basic_score: z.number().nullable().optional(),
  operation_score: z.number().nullable().optional(),
  troubleshooting_score: z.number().nullable().optional(),
  exam_status: z.string(),
  match_action: z.enum(["ready", "review", "exclude"]),
  match_status: z.enum(["matched", "review", "unmatched"]),
  review_reason: z.string().nullable().optional(),
  matched_partner_id: z.string().uuid().nullable().optional(),
  matched_partner_name: z.string().nullable().optional(),
  matched_contact_id: z.string().uuid().nullable().optional(),
  exam_raw_json: z.record(z.string(), z.unknown()).nullable().optional(),
  roster_source_file: z.string().nullable().optional(),
  exam_source_file: z.string().nullable().optional(),
  attendance_scope: z.string().nullable().optional(),
  manual_correction_note: z.string().nullable().optional(),
  correction_applied: z.boolean().optional(),
  review_category: z.string().nullable().optional()
});

export const TechPartnerTrainingImportSchema = z.object({
  exam_file_name: z.string(),
  roster_file_name: z.string(),
  participants: z.array(ParticipantSchema).min(1)
});

export type TechPartnerTrainingImportPayload = z.infer<typeof TechPartnerTrainingImportSchema>;
