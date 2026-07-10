import { createClient } from "@/lib/supabase/server";
import { PARTNER_GRADE_LABEL, PARTNER_GRADE_ORDER } from "@/lib/constants";
import { getDisplayPartnerGrade } from "@/lib/partners/grade";
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

export type CumulativePartnerPoint = {
  key: string;
  label: string;
  fullLabel: string;
  year: number;
  month: number;
  quarter: 1 | 2 | 3 | 4;
  cumulative: number;
  monthlyNew: number;
};

export type DashboardStats = {
  partnerCount: number;
  platinumCount: number;
  servicePartnerCount: number;
  goldCount: number;
  silverCount: number;
  newContractsThisYear: number;
  newContractsThisMonth: number;
  thisMonthLabel: string;
  thisMonthKey: string;
  contactCount: number;
  trainingAttendeeCount: number;
  gradeDist: Array<{ key: string; label: string; value: number; color: string }>;
  regionDist: Array<{ label: string; value: number; color: string }>;
  monthlyNewContracts: Array<{ label: string; value: number }>;
  cumulativePartners: CumulativePartnerPoint[];
  recentContracts: RecentContractPartner[];
};

const REGION_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-slate-400"
];

const GRADE_COLOR: Record<string, string> = {
  platinum: "bg-violet-500",
  service_partner: "bg-teal-500",
  gold: "bg-amber-500",
  silver: "bg-slate-400",
  strategic: "bg-blue-500",
  none: "bg-slate-300"
};

function getCurrentMonth(now = new Date()) {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    label: `${now.getFullYear()}년 ${now.getMonth() + 1}월`,
    key: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  };
}

function getQuarter(month: number): 1 | 2 | 3 | 4 {
  return (Math.ceil(month / 3) as 1 | 2 | 3 | 4);
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [
    { data: partnersData },
    { data: contactRows },
    { data: trainingRows }
  ] = await Promise.all([
    supabase.from("partners").select("*").is("deleted_at", null),
    supabase
      .from("partner_contacts")
      .select("partner_id")
      .eq("is_active", true)
      .eq("in_current_full_db", true)
      .is("deleted_at", null),
    supabase.from("training_attendance").select("id, partner_id")
  ]);

  const partners = filterSamplePartners((partnersData ?? []) as Partner[]).filter(
    (partner) => partner.is_active !== false
  );
  const realPartnerIds = new Set(partners.map((partner) => partner.id));

  const contactCount = (contactRows ?? []).filter((row) =>
    realPartnerIds.has(String(row.partner_id))
  ).length;

  const trainingAttendeeCount = (trainingRows ?? []).filter((row) =>
    row.partner_id ? realPartnerIds.has(String(row.partner_id)) : false
  ).length;

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = getCurrentMonth(now);

  let platinumCount = 0;
  let servicePartnerCount = 0;
  let goldCount = 0;
  let silverCount = 0;
  let newContractsThisYear = 0;
  let newContractsThisMonth = 0;

  for (const partner of partners) {
    const grade = getDisplayPartnerGrade(partner);
    if (grade === "platinum") platinumCount += 1;
    if (grade === "service_partner") servicePartnerCount += 1;
    if (grade === "gold") goldCount += 1;
    if (grade === "silver") silverCount += 1;

    const contractDate = parseContractDate(partner.contract_start_date);
    if (!contractDate) continue;

    if (contractDate.getFullYear() === thisYear) {
      newContractsThisYear += 1;
    }

    if (
      contractDate.getFullYear() === thisMonth.year &&
      contractDate.getMonth() + 1 === thisMonth.month
    ) {
      newContractsThisMonth += 1;
    }
  }

  return {
    partnerCount: partners.length,
    platinumCount,
    servicePartnerCount,
    goldCount,
    silverCount,
    newContractsThisYear,
    newContractsThisMonth,
    thisMonthLabel: thisMonth.label,
    thisMonthKey: thisMonth.key,
    contactCount,
    trainingAttendeeCount,
    gradeDist: computeGradeDistribution(partners),
    regionDist: computeRegionDistribution(partners),
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
      grade_label:
        PARTNER_GRADE_LABEL[getDisplayPartnerGrade(partner)] ?? "미분류",
      contract_start_date: partner.contract_start_date!
    }));
}

function computeGradeDistribution(partners: Partner[]) {
  const counts = new Map<string, number>();
  for (const partner of partners) {
    const grade = getDisplayPartnerGrade(partner);
    counts.set(grade, (counts.get(grade) ?? 0) + 1);
  }

  return PARTNER_GRADE_ORDER.filter((grade) => (counts.get(grade) ?? 0) > 0).map((grade) => ({
    key: grade,
    label: PARTNER_GRADE_LABEL[grade] ?? grade,
    value: counts.get(grade) ?? 0,
    color: GRADE_COLOR[grade] ?? "bg-blue-500"
  }));
}

function computeRegionDistribution(partners: Partner[]) {
  const counts = new Map<string, number>();
  for (const partner of partners) {
    const region = partner.region_group?.trim() || "미지정";
    counts.set(region, (counts.get(region) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value], index) => ({
      label,
      value,
      color: REGION_COLORS[index % REGION_COLORS.length]!
    }));
}

function buildMonthBucketsFromJuly2024() {
  const buckets: Array<{
    key: string;
    shortLabel: string;
    fullLabel: string;
    year: number;
    month: number;
    quarter: 1 | 2 | 3 | 4;
    endDate: Date;
    startDate: Date;
  }> = [];

  const now = new Date();
  const endCursor = new Date(now.getFullYear(), now.getMonth(), 1);
  let cursor = new Date(CUMULATIVE_START_YEAR, CUMULATIVE_START_MONTH - 1, 1);

  while (cursor <= endCursor) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    buckets.push({
      key: `${year}-${String(month).padStart(2, "0")}`,
      shortLabel: `${String(year).slice(2)}.${String(month).padStart(2, "0")}`,
      fullLabel: `${year}년 ${month}월`,
      year,
      month,
      quarter: getQuarter(month),
      startDate,
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

    const key = `${contractDate.getFullYear()}-${String(contractDate.getMonth() + 1).padStart(2, "0")}`;
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.shortLabel,
    value: counts.get(bucket.key) ?? 0
  }));
}

function computeCumulativePartners(partners: Partner[]): CumulativePartnerPoint[] {
  const buckets = buildMonthBucketsFromJuly2024();
  const contractDates = partners
    .map((partner) => parseContractDate(partner.contract_start_date))
    .filter((date): date is Date => date != null);

  return buckets.map((bucket) => {
    const monthlyNew = contractDates.filter(
      (date) =>
        date >= bucket.startDate &&
        date <= bucket.endDate
    ).length;

    return {
      key: bucket.key,
      label: bucket.shortLabel,
      fullLabel: bucket.fullLabel,
      year: bucket.year,
      month: bucket.month,
      quarter: bucket.quarter,
      cumulative: contractDates.filter((date) => date <= bucket.endDate).length,
      monthlyNew
    };
  });
}
