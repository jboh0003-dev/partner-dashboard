import { createClient } from "@/lib/supabase/server";
import {
  filterRowsByPartnerId,
  filterSamplePartners
} from "@/lib/partners/sample-filter";
import type { RecruitmentSourceData } from "@/lib/trainings/recruitment";
import type { Partner, PartnerContact } from "@/types/partner";
import type { Training } from "@/types/training";

export async function fetchRecruitmentSourceData(): Promise<
  RecruitmentSourceData & { error: string | null }
> {
  const supabase = await createClient();

  const [
    { data: partnersData, error: partnersError },
    { data: contactsData, error: contactsError },
    { data: attendancesData, error: attendancesError },
    { data: trainingsData, error: trainingsError }
  ] = await Promise.all([
    supabase.from("partners").select("*").order("company_name", { ascending: true }),
    supabase.from("partner_contacts").select("*"),
    supabase.from("training_attendance").select("partner_id, training_id, attended"),
    supabase
      .from("trainings")
      .select("*")
      .order("training_year", { ascending: false, nullsFirst: false })
      .order("training_month", { ascending: false, nullsFirst: false })
      .order("start_date", { ascending: false, nullsFirst: false })
  ]);

  const partners = filterSamplePartners((partnersData ?? []) as Partner[]);
  const realPartnerIds = new Set(partners.map((partner) => partner.id));

  const errors = [partnersError, contactsError, attendancesError, trainingsError]
    .filter(Boolean)
    .map((error) => error!.message);

  return {
    partners,
    contacts: filterRowsByPartnerId((contactsData ?? []) as PartnerContact[], realPartnerIds),
    attendances: filterRowsByPartnerId(
      (attendancesData ?? []) as RecruitmentSourceData["attendances"],
      realPartnerIds
    ),
    trainings: (trainingsData ?? []) as Training[],
    error: errors.length > 0 ? errors.join("; ") : null
  };
}
