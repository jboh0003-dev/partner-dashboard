import Link from "next/link";
import { PageHero } from "@/components/layout/page-hero";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { GradeDistributionChart, VerticalBarChart } from "@/components/dashboard/bar-chart";
import { LineChart } from "@/components/dashboard/line-chart";
import { ExecutivePerformanceSection } from "@/components/performance/executive-performance-section";
import { fetchDashboardStats } from "@/lib/data/dashboard";
import { fetchExecutivePerformanceStats } from "@/lib/data/partner-performance";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CHART_SECTION_CLASS = "flex min-h-[320px] flex-col";
const CHART_BODY_CLASS = "flex min-h-0 flex-1 flex-col";

export default async function DashboardPage() {
  const [stats, performanceStats] = await Promise.all([
    fetchDashboardStats(),
    fetchExecutivePerformanceStats()
  ]);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const hasCumulativeData = stats.cumulativePartners.some((point) => point.value > 0);
  const hasMonthlyData = stats.monthlyNewContracts.some((point) => point.value > 0);
  const recentContracts = stats.recentContracts.slice(0, 8);

  return (
    <>
      <PageHero
        compact
        title="파트너 운영 현황"
        description="계약·등급·인력·장비 기준의 파트너 운영 현황을 한눈에 확인합니다."
      />

      <section className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4 xl:grid-cols-8">
        <KpiCard
          label="전체 파트너"
          value={stats.partnerCount}
          href="/dashboard/partners"
        />
        <KpiCard label="Platinum" value={stats.platinumCount} />
        <KpiCard label="Gold" value={stats.goldCount} />
        <KpiCard label="Silver" value={stats.silverCount} />
        <KpiCard
          label="올해 신규 계약"
          value={stats.newContractsThisYear}
          hint={`${currentYear}년`}
        />
        <KpiCard
          label="이번 달 신규 계약"
          value={stats.newContractsThisMonth}
          hint={`${currentMonth}월`}
        />
        <KpiCard
          label="전체 인력/담당자"
          value={stats.contactCount}
          href="/dashboard/contacts"
        />
        <KpiCard
          label="장비 보유 파트너"
          value={stats.equipmentPartnerCount}
          href="/dashboard/assets"
        />
      </section>

      <section className="mt-5 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <ChartCard title="파트너 누적 증가" className={`xl:col-span-2 ${CHART_SECTION_CLASS}`}>
          <div className={CHART_BODY_CLASS}>
            {hasCumulativeData ? (
              <LineChart data={stats.cumulativePartners} />
            ) : (
              <ChartEmpty />
            )}
          </div>
        </ChartCard>

        <ChartCard title="등급별 파트너 분포" className={CHART_SECTION_CLASS}>
          <div className={CHART_BODY_CLASS}>
            {stats.gradeDist.length === 0 ? (
              <ChartEmpty />
            ) : (
              <GradeDistributionChart
                data={stats.gradeDist.map((item) => ({
                  label: item.label,
                  value: item.value,
                  color: item.color
                }))}
              />
            )}
          </div>
        </ChartCard>
      </section>

      <ExecutivePerformanceSection stats={performanceStats} />

      <section className="mt-5 grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <ChartCard
          title="월별 신규 파트너 계약"
          className={`xl:col-span-2 ${CHART_SECTION_CLASS}`}
        >
          <div className={CHART_BODY_CLASS}>
            {hasMonthlyData ? (
              <VerticalBarChart data={stats.monthlyNewContracts} barColor="fill-emerald-500" />
            ) : (
              <ChartEmpty />
            )}
          </div>
        </ChartCard>

        <ChartCard title="최근 신규 계약 파트너" className={CHART_SECTION_CLASS}>
          {recentContracts.length === 0 ? (
            <ChartEmpty message="최근 신규 계약 파트너가 없습니다." />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <ul className="min-h-0 flex-1 space-y-1">
                {recentContracts.map((partner) => (
                  <li
                    key={partner.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/partners/${partner.id}`}
                        className="block truncate text-sm font-semibold text-okestro-600 hover:text-okestro-700 hover:underline"
                        title={partner.company_name}
                      >
                        {partner.company_name}
                      </Link>
                      <p className="mt-0.5 text-2xs font-medium text-slate-500">
                        {partner.grade_label}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-2xs tabular-nums text-slate-600">
                      {formatDate(partner.contract_start_date)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto border-t border-slate-100 pt-3 text-right">
                <Link href="/dashboard/partners" className="text-xs font-semibold text-okestro-600 hover:underline">
                  전체 파트너 보기 →
                </Link>
              </div>
            </div>
          )}
        </ChartCard>
      </section>

      <div className="mt-4 text-right">
        <Link
          href="/dashboard/trainings"
          className="text-xs font-medium text-slate-400 transition hover:text-blue-700"
        >
          교육 현황은 교육 메뉴에서 확인 →
        </Link>
      </div>
    </>
  );
}

function ChartCard({
  title,
  children,
  className = ""
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={["ui-card flex flex-col px-4 py-4", className].join(" ")}>
      <h2 className="mb-3 shrink-0 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function ChartEmpty({ message = "표시할 데이터가 없습니다." }: { message?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-14 text-xs text-slate-400">
      {message}
    </div>
  );
}
