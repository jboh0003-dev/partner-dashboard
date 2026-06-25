export type Training = {
  id: string;
  training_name: string;
  training_type: string | null;
  training_level: string | null;
  product: string | null;
  product_name: string | null;
  session_name: string | null;
  training_year: number | null;
  training_month: number | null;
  start_date: string | null;
  end_date: string | null;
  source_file: string | null;
  memo: string | null;
  created_at: string;
};

export type TrainingAttendance = {
  id: string;
  partner_id: string;
  training_id: string;
  attendee_name: string | null;
  attendee_department: string | null;
  attendee_position: string | null;
  attendee_phone: string | null;
  attendee_email: string | null;
  attended: boolean;
  attendance_status: string | null;
  completion_status: string | null;
  raw_value: string | null;
  source_file: string | null;
  score: number | null;
  evaluation_result: string | null;
  note: string | null;
  evaluation_memo: string | null;
  created_at: string;
};
