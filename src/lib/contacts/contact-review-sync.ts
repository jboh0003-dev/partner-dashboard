import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALL_EMAILS_BOUNCED_REASON,
  NO_SENDABLE_EMAIL_REASON,
  resolveContactEmailReviewReason
} from "@/lib/contacts/email-deliverability";

export async function syncContactEmailReviewFlags(
  supabase: SupabaseClient,
  contactId: string
): Promise<void> {
  const { data: emails } = await supabase
    .from("contact_emails")
    .select("email, is_bounced, is_sendable")
    .eq("contact_id", contactId);

  const reviewReason = resolveContactEmailReviewReason(
    (emails ?? []) as Array<{ email: string; is_bounced: boolean; is_sendable: boolean }>
  );

  if (!reviewReason) {
    const { data: contact } = await supabase
      .from("partner_contacts")
      .select("review_reason")
      .eq("id", contactId)
      .maybeSingle();

    const existing = (contact?.review_reason as string | null) ?? "";
    if (
      existing === NO_SENDABLE_EMAIL_REASON ||
      existing === ALL_EMAILS_BOUNCED_REASON ||
      existing.includes("발송 가능한 이메일")
    ) {
      await supabase
        .from("partner_contacts")
        .update({ review_required: false, review_reason: null })
        .eq("id", contactId);
    }
    return;
  }

  await supabase
    .from("partner_contacts")
    .update({
      review_required: true,
      review_reason: reviewReason
    })
    .eq("id", contactId);
}

export async function fetchContactTrainingHistory(
  supabase: SupabaseClient,
  contactId: string
): Promise<
  Array<{
    id: string;
    training_name: string | null;
    training_date: string | null;
    attendance_status: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("training_attendance")
    .select(
      "id, attendance_status, training:trainings(training_name, start_date, training_year, training_month)"
    )
    .eq("contact_id", contactId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const training = Array.isArray(row.training) ? row.training[0] : row.training;
    const startDate =
      (training?.start_date as string | null | undefined) ??
      (training?.training_year && training?.training_month
        ? `${training.training_year}-${String(training.training_month).padStart(2, "0")}-01`
        : null);

    return {
      id: String(row.id),
      training_name: (training?.training_name as string | null | undefined) ?? null,
      training_date: startDate,
      attendance_status: (row.attendance_status as string | null | undefined) ?? null
    };
  });
}
