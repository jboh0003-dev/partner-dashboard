import { createClient } from "@/lib/supabase/server";
import { PARTNER_GRADE_LABEL, PARTNER_GRADE_ORDER } from "@/lib/constants";
import { filterSamplePartners } from "@/lib/partners/sample-filter";
import type { Partner } from "@/types/partner";

const CUMULATIVE_START_YEAR = 2024;
const CUMULATIVE_START_MONTH = 7;

export type RecentContractPartner = {
  id: string;
  company_name: string;
  grade_label: string;
  contract_start_date: string;
};

export type DashboardStats = {
  partnerCount: number;
  platinumCount: number;
  goldCount: number;
  silverCount: number;
  newContractsThisYear: number;
  newContractsThisMonth: number;
  contactCount: number;
  equipmentPartnerCount: number;
  gradeDist: Array<{ key: string; label: string; value: number; color: string }>;
  monthlyNewContracts: Array<{ label: string; value: number }>;
  cumulativePartners: Array<{ label: string; value: number }>;
  recentContracts: RecentContractPartner[];
};

const GRADE_COLOR: Record<string, string> = {
  platinum: "bg-violet-500",
  gold: "bg-amber-500",
  silver: "bg-slate-400",
  strategic: "bg-blue-500",
  none: "bg-slate-300"
};

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [
    { data: partnersData },
    { data: contactRows },
    { data: assetRows }
  ] = await Promise.all([
    supabase.from("partners").select("*"),
    supabase.from("partner_contacts").select("partner_id"),
    supabase.from("partner_assets").select("partner_id, partners!inner(company_name)")
  ]);

  const partners = filterSamplePartners((partnersData ?? []) as Partner[]);
  const realPartnerIds = new Set(partners.map((partner) => partner.id));

  const contactCount = (contactRows ?? []).filter((row) =>
    realPartnerIds.has(String(row.partner_id))
  ).length;

  const equipmentPartnerCount = new Set(
    (assetRows ?? [])
      .filter((row) => row.partner_id && realPartnerIds.has(String(row.partner_id)))
      .map((row) => row.partner_id)
  ).size;

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;

  let platinumCount = 0;
  let goldCount = 0;
  let silverCount = 0;
  let newContractsThisYear = 0;
  let newContractsThisMonth = 0;

  for (const partner of partners) {
    const grade = partner.grade ?? "none";
    if (grade === "platinum") platinumCount += 1;
    if (grade === "gold") goldCount += 1;
    if (grade === "silver") silverCount += 1;

    const contractDate = parseContractDate(partner.contract_start_date);
    if (!contractDate) continue;

    if (contractDate.getFullYear() === thisYear) {
      newContractsThisYear += 1;
      if (contractDate.getMonth() + 1 === thisMonth) {
        newContractsThisMonth += 1;
      }
    }
  }

  return {
    partnerCount: partners.length,
    platinumCount,
    goldCount,
    silverCount,
    newContractsThisYear,
    newContractsThisMonth,
    contactCount,
    equipmentPartnerCount,
    gradeDist: computeGradeDistribution(partners),
    monthlyNewContracts: computeMonthlyNewContracts(partners),
    cumulativePartners: computeCumulativePartners(partners),
    recentContracts: computeRecentContracts(partners)
  };
}

function parseContractDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeRecentContracts(partners: Partner[], limit = 8): RecentContractPartner[] {
  return partners
    .filter((partner) => partner.contract_start_date)
    .sort((left, right) => {
      const leftTime = parseContractDate(left.contract_start_date)?.getTime() ?? 0;
      const rightTime = parseContractDate(right.contract_start_date)?.getTime() ?? 0;
      return rightTime - leftTime;
    })
    .slice(0, limit)
    .map((partner) => ({
      id: partner.id,
      company_name: partner.company_name,
      grade_label: PARTNER_GRADE_LABEL[partner.grade ?? "none"] ?? "미분류",
      contract_start_date: partner.contract_start_date!
    }));
}

function computeGradeDistribution(partners: Partner[]) {
  const counts = new Map<string, number>();
  for (const partner of partners) {
    const grade = partner.grade ?? "none";
    counts.set(grade, (counts.get(grade) ?? 0) + 1);
  }

  return PARTNER_GRADE_ORDER.filter((grade) => (counts.get(grade) ?? 0) > 0).map((grade) => ({
    key: grade,
    label: PARTNER_GRADE_LABEL[grade] ?? grade,
    value: counts.get(grade) ?? 0,
    color: GRADE_COLOR[grade] ?? "bg-blue-500"
  }));
}

function buildMonthBucketsFromJuly2024() {
  const buckets: Array<{
    key: string;
    shortLabel: string;
    year: number;
    month: number;
    endDate: Date;
  }> = [];

  const now = new Date();
  const endCursor = new Date(now.getFullYear(), now.getMonth(), 1);
  let cursor = new Date(CUMULATIVE_START_YEAR, CUMULATIVE_START_MONTH - 1, 1);

  while (cursor <= endCursor) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    buckets.push({
      key: `${year}-${month}`,
      shortLabel: `${String(year).slice(2)}.${String(month).padStart(2, "0")}`,
      year,
      month,
      endDate
    });

    cursor = new Date(year, month, 1);
  }

  return buckets;
}

function computeMonthlyNewContracts(partners: Partner[]) {
  const buckets = buildMonthBucketsFromJuly2024();
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

  for (const partner of partners) {
    const contractDate = parseContractDate(partner.contract_start_date);
    if (!contractDate) continue;

    const key = `${contractDate.getFullYear()}-${contractDate.getMonth() + 1}`;
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.shortLabel,
    value: counts.get(bucket.key) ?? 0
  }));
}

function computeCumulativePartners(partners: Partner[]) {
  const buckets = buildMonthBucketsFromJuly2024();
  const contractDates = partners
    .map((partner) => parseContractDate(partner.contract_start_date))
    .filter((date): date is Date => date != null);

  return buckets.map((bucket) => ({
    label: bucket.shortLabel,
    value: contractDates.filter((date) => date <= bucket.endDate).length
  }));
}
