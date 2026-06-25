import { createClient } from "@/lib/supabase/server";
import { isSamplePartner, isSamplePartnerName } from "@/lib/partners/sample-filter";
import {
  computeDataQualityBundle,
  type DataQualityBundle
} from "@/lib/data/data-quality-shared";
import type { PartnerAsset } from "@/types/asset";
import type { Partner, PartnerContact } from "@/types/partner";
import type { TrainingAttendance } from "@/types/training";

export * from "@/lib/data/data-quality-shared";

type DocumentRow = {
  id: string;
  partner_id: string;
  partner_name: string;
  document_type: string | null;
  extracted_partner_name: string | null;
  match_status: string | null;
  review_status: string | null;
  original_filename: string | null;
  display_name: string | null;
  file_name: string;
};

type AssetRow = PartnerAsset & { partner_name: string };
type AttendanceRow = TrainingAttendance & {
  partner_name: string;
  training_name?: string | null;
  training_year?: number | null;
  training_month?: number | null;
};

export async function fetchDataQualityBundle(): Promise<DataQualityBundle> {
  const supabase = await createClient();
  const errors: string[] = [];
  const fetchedAt = new Date().toISOString();

  let partners: Partner[] = [];
  let contacts: PartnerContact[] = [];
  let documents: DocumentRow[] = [];
  let assets: AssetRow[] = [];
  let attendances: AttendanceRow[] = [];

  try {
    const { data, error } = await supabase.from("partners").select("*").order("company_name");
    if (error) errors.push(`파트너 조회 실패: ${error.message}`);
    else partners = ((data ?? []) as Partner[]).filter((partner) => !isSamplePartner(partner));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "파트너 조회 중 오류");
  }

  try {
    const { data, error } = await supabase.from("partner_contacts").select("*");
    if (error) errors.push(`담당자 조회 실패: ${error.message}`);
    else {
      const realPartnerIds = new Set(partners.map((partner) => partner.id));
      contacts = ((data ?? []) as PartnerContact[]).filter((contact) =>
        realPartnerIds.has(contact.partner_id)
      );
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "담당자 조회 중 오류");
  }

  try {
    const { data, error } = await supabase
      .from("partner_documents")
      .select("*, partners!inner(company_name)")
      .is("deleted_at", null);
    if (error) errors.push(`문서 조회 실패: ${error.message}`);
    else {
      documents = (data ?? [])
        .map((row) => {
          const item = row as Record<string, unknown>;
          const partnerRef = item.partners as { company_name: string } | { company_name: string }[];
          const partner = Array.isArray(partnerRef) ? partnerRef[0] : partnerRef;
          return {
            id: String(item.id),
            partner_id: String(item.partner_id),
            partner_name: partner?.company_name ?? "(미상)",
            document_type: (item.document_type as string | null) ?? null,
            extracted_partner_name: (item.extracted_partner_name as string | null) ?? null,
            match_status: (item.match_status as string | null) ?? null,
            review_status: (item.review_status as string | null) ?? null,
            original_filename: (item.original_filename as string | null) ?? null,
            display_name: (item.display_name as string | null) ?? null,
            file_name: String(item.file_name ?? item.original_filename ?? "")
          } satisfies DocumentRow;
        })
        .filter((row) => !isSamplePartnerName(row.partner_name));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "문서 조회 중 오류");
  }

  try {
    const { data, error } = await supabase
      .from("partner_assets")
      .select("*, partners!inner(company_name)");
    if (error) errors.push(`장비 조회 실패: ${error.message}`);
    else {
      assets = (data ?? [])
        .map((row) => {
          const item = row as Record<string, unknown> & {
            partners?: { company_name: string } | Array<{ company_name: string }>;
          };
          const partner = Array.isArray(item.partners) ? item.partners[0] : item.partners;
          const { partners: _partners, ...asset } = item;
          return {
            ...(asset as PartnerAsset),
            partner_name: partner?.company_name ?? "(미상)"
          } satisfies AssetRow;
        })
        .filter((row) => !isSamplePartnerName(row.partner_name));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "장비 조회 중 오류");
  }

  try {
    const { data, error } = await supabase
      .from("training_attendance")
      .select(
        "*, partners!inner(company_name), trainings!inner(training_name, training_year, training_month)"
      );
    if (error) errors.push(`교육 참석 조회 실패: ${error.message}`);
    else {
      attendances = (data ?? [])
        .map((row) => {
          const item = row as Record<string, unknown> & {
            partners?: { company_name: string } | Array<{ company_name: string }>;
            trainings?:
              | { training_name: string; training_year: number | null; training_month: number | null }
              | Array<{
                  training_name: string;
                  training_year: number | null;
                  training_month: number | null;
                }>;
          };
          const partner = Array.isArray(item.partners) ? item.partners[0] : item.partners;
          const training = Array.isArray(item.trainings) ? item.trainings[0] : item.trainings;
          const { partners: _partners, trainings: _trainings, ...attendance } = item;
          return {
            ...(attendance as TrainingAttendance),
            partner_name: partner?.company_name ?? "(미상)",
            training_name: training?.training_name ?? null,
            training_year: training?.training_year ?? null,
            training_month: training?.training_month ?? null
          } satisfies AttendanceRow;
        })
        .filter((row) => !isSamplePartnerName(row.partner_name));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "교육 참석 조회 중 오류");
  }

  return computeDataQualityBundle({
    partners,
    contacts,
    documents,
    assets,
    attendances,
    errors,
    fetchedAt
  });
}
