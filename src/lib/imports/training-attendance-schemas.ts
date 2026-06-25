import { z } from "zod";

export const TrainingAttendanceRowSchema = z.object({
  row_number: z.number().int(),
  excluded: z.boolean(),
  excluded_reason: z.string().nullable(),
  company_name: z.string(),
  attendee_name: z.string(),
  training_name: z.string(),
  start_date: z.string().nullable(),
  training_year: z.number().nullable(),
  training_month: z.number().nullable(),
  training_type: z.string().nullable().default(null),
  training_level: z.string().nullable().default(null),
  product: z.string().nullable().default(null),
  attendee_department: z.string().nullable(),
  attendee_position: z.string().nullable(),
  attendee_phone: z.string().nullable(),
  attendee_email: z.string().nullable(),
  attendance_status: z.string().nullable(),
  attended: z.boolean(),
  completion_status: z.string().nullable().default(null),
  score: z.number().nullable().default(null),
  evaluation_result: z.string().nullable().default(null),
  note: z.string().nullable().default(null),
  attendee_memo: z.string().nullable().default(null),
  raw_value: z.string().nullable(),
  source_file: z.string(),
  warnings: z.array(z.string())
});

export const TrainingAttendanceImportSchema = z.object({
  file_name: z.string().min(1),
  rows: z.array(TrainingAttendanceRowSchema)
});

export type TrainingAttendanceImportRow = z.infer<typeof TrainingAttendanceRowSchema>;
