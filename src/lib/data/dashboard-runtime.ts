import { createAdminClient } from "@/lib/supabase/admin";
import { PARTNER_GRADE_LABEL, PARTNER_GRADE_ORDER } from "@/lib/constants";
import { getDisplayPartnerGrade } from "@/lib/partners/grade";
import { filterOfficialPartnerStatsPartners } from "@/lib/partners/official-stats-exclude";
import { filterSamplePartners } from "@/lib/partners/sample-filter";
import type { DashboardStats } from "@/lib/data/dashboard";
import type { Partner } from "@/types/partner";

export type DashboardRuntimeStats = Pick<
  DashboardStats,
  | "partnerCount"
  | "platinumCount"
  | "servicePartnerCount"
  | "goldCount"
  | "silverCount"
  | "newContractsThisYear"
  | "newContractsPreviousMonth"
  | "contactCount"
  | "trainingAttendeeCount"
  | "gradeDist"
  | "regionDist"
>;

const PARTNER_SELECT =
  "id, company_name, contract_display_name, external_no, memo, is_active, deleted_at, grade, grade_override, grade_change_raw, grade_original, contract_start_date, region_group";

const GRADE_COLOR: Record<string, string> = {
  platinum: "bg-violet-500",
  service_partner: "bg-teal-500",
  gold: "bg-amber-500",
  silver: "bg-slate-400",
  strategic: "bg-blue-500",
  none: "bg-slate-300"
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

function previousMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function fetchAllPartners() {
  const supabase = createAdminClient();
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("partners")
      .select(PARTNER_SELECT)
      .is("deleted_at", null)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows as unknown as Partner[];
}

async function countRowsByPartnerIds(
  table: "partner_contacts" | "training_attendance",
  partnerIds: string[]
): Promise<number> {
  if (partnerIds.length === 0) return 0;

  const supabase = createAdminClient();
  const chunkSize = 150;
  let total = 0;

  for (let i = 0; i < partnerIds.length; i += chunkSize) {
    const chunk = partnerIds.slice(i, i + chunkSize);
    let query = supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("partner_id", chunk);

    if (table === "partner_contacts") {
      query = query
        .eq("is_active", true)
        .eq("in_current_full_db", true)
        .is("deleted_at", null);
    }

    const { count, error } = await query;
    if (error) throw new Error(error.message);
    total += count ?? 0;
  }

  return total;
}

function buildGradeDist(partners: Partner[]) {
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

function buildRegionDist(partners: Partner[]) {
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

/**
 * 운영 대시보드 전용 읽기 경로.
 * 인증은 middleware에서 검증하고, 실제 KPI 조회는 서버 전용 service-role client로 수행한다.
 * SSR 세션 refresh/clock-skew가 통계 조회를 막지 않도록 사용자 JWT를 데이터 조회에 재사용하지 않는다.
 */
export async function fetchDashboardRuntimeStats(): Promise<DashboardRuntimeStats> {
  const rawPartners = await fetchAllPartners();
  const partners = filterOfficialPartnerStatsPartners(
    filterSamplePartners(rawPartners).filter((partner) => partner.is_active !== false)
  );

  const partnerIds = partners.map((partner) => partner.id);
  const [contactCount, trainingAttendeeCount] = await Promise.all([
    countRowsByPartnerIds("partner_contacts", partnerIds),
    countRowsByPartnerIds("training_attendance", partnerIds)
  ]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const prev = previousMonth(now);

  let platinumCount = 0;
  let servicePartnerCount = 0;
  let goldCount = 0;
  let silverCount = 0;
  let newContractsThisYear = 0;
  let newContractsPreviousMonth = 0;

  for (const partner of partners) {
    const grade = getDisplayPartnerGrade(partner);
    if (grade === "platinum") platinumCount += 1;
    if (grade === "service_partner") servicePartnerCount += 1;
    if (grade === "gold") goldCount += 1;
    if (grade === "silver") silverCount += 1;

    const contractDate = parseDate(partner.contract_start_date);
    if (!contractDate) continue;

    if (contractDate.getFullYear() === currentYear) {
      newContractsThisYear += 1;
    }

    if (
      contractDate.getFullYear() === prev.getFullYear() &&
      contractDate.getMonth() === prev.getMonth()
    ) {
      newContractsPreviousMonth += 1;
    }
  }

  return {
    partnerCount: partners.length,
    platinumCount,
    servicePartnerCount,
    goldCount,
    silverCount,
    newContractsThisYear,
    newContractsPreviousMonth,
    contactCount,
    trainingAttendeeCount,
    gradeDist: buildGradeDist(partners),
    regionDist: buildRegionDist(partners)
  };
}
