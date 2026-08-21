import Link from "next/link";
import type { DashboardStats } from "@/lib/data/dashboard";

type ExecutiveKpiGridProps = {
  stats: DashboardStats;
  currentYear: number;
};

const CARD_CLASS =
  "ui-enter-item flex h-full min-h-[9.5rem] flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-okestro-200 hover:shadow-elevated";

export function ExecutiveKpiGrid({ stats, currentYear }: ExecutiveKpiGridProps) {
  return (
    <section className="ui-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/dashboard/partners" className={CARD_CLASS}>
        <p className="text-sm font-semibold leading-snug text-slate-800">전체 파트너</p>
        <p className="mt-3 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-950">
          {stats.partnerCount.toLocaleString("ko-KR")}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
          <GradeBadge label="P" count={stats.platinumCount} tone="violet" />
          <GradeBadge label="G" count={stats.goldCount} tone="amber" />
          <GradeBadge label="S" count={stats.silverCount} tone="slate" />
          <GradeBadge label="Service" count={stats.servicePartnerCount} tone="teal" />
        </div>
      </Link>

      <Link href={`/dashboard/partners?contractYear=${currentYear}`} className={CARD_CLASS}>
        <p className="text-sm font-semibold leading-snug text-slate-800">신규 계약</p>
        <p className="mt-3 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-950">
          {stats.newContractsThisYear.toLocaleString("ko-KR")}
          <span className="ml-1 text-base font-semibold text-slate-600">건</span>
        </p>
        <p className="mt-auto pt-4 text-xs font-medium text-slate-500">
          {currentYear}년 · 이전달 {stats.newContractsPreviousMonth.toLocaleString("ko-KR")}건
        </p>
      </Link>

      <Link href="/dashboard/contacts" className={CARD_CLASS}>
        <p className="text-sm font-semibold leading-snug text-slate-800">현재 인력/담당자</p>
        <p className="mt-3 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-950">
          {stats.contactCount.toLocaleString("ko-KR")}
        </p>
        <p className="mt-auto pt-4 text-xs font-medium text-slate-500">전체DB 기준 현재 담당자</p>
      </Link>

      <Link href="/dashboard/trainings" className={CARD_CLASS}>
        <p className="text-sm font-semibold leading-snug text-slate-800">교육 참석 이력</p>
        <p className="mt-3 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-950">
          {stats.trainingAttendeeCount.toLocaleString("ko-KR")}
        </p>
        <p className="mt-auto pt-4 text-xs font-medium text-slate-500">{currentYear}년 누적 참석 이력</p>
      </Link>
    </section>
  );
}

function GradeBadge({
  label,
  count,
  tone
}: {
  label: string;
  count: number;
  tone: "violet" | "amber" | "slate" | "teal";
}) {
  const toneClass =
    tone === "violet"
      ? "bg-violet-100 text-violet-900 ring-violet-200"
      : tone === "amber"
        ? "bg-amber-100 text-amber-950 ring-amber-200"
        : tone === "teal"
          ? "bg-teal-100 text-teal-950 ring-teal-200"
          : "bg-slate-200 text-slate-800 ring-slate-300";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${toneClass}`}
    >
      {label} {count.toLocaleString("ko-KR")}
    </span>
  );
}
