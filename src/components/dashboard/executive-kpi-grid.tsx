import Link from "next/link";
import type { DashboardStats } from "@/lib/data/dashboard";

type ExecutiveKpiGridProps = {
  stats: DashboardStats;
  currentYear: number;
};

const CARD_CLASS =
  "flex h-full min-h-[8.5rem] flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

export function ExecutiveKpiGrid({ stats, currentYear }: ExecutiveKpiGridProps) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link href="/dashboard/partners" className={`${CARD_CLASS} transition hover:ring-2 hover:ring-okestro-200`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">전체 파트너</p>
        <p className="mt-2 text-3xl font-bold tabular-nums leading-none text-slate-950">
          {stats.partnerCount.toLocaleString("ko-KR")}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          <GradeBadge label="P" count={stats.platinumCount} tone="violet" />
          <GradeBadge label="G" count={stats.goldCount} tone="amber" />
          <GradeBadge label="S" count={stats.silverCount} tone="slate" />
          <GradeBadge label="Service" count={stats.servicePartnerCount} tone="teal" />
        </div>
      </Link>

      <Link
        href={`/dashboard/partners?contractYear=${currentYear}`}
        className={`${CARD_CLASS} transition hover:ring-2 hover:ring-okestro-200`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">신규 계약</p>
        <p className="mt-2 text-3xl font-bold tabular-nums leading-none text-slate-950">
          올해 {stats.newContractsThisYear.toLocaleString("ko-KR")}건
        </p>
        <p className="mt-auto pt-3 text-xs text-slate-500">
          이달 {stats.newContractsThisMonth.toLocaleString("ko-KR")}건
        </p>
      </Link>

      <Link href="/dashboard/contacts" className={`${CARD_CLASS} transition hover:ring-2 hover:ring-okestro-200`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">현재 인력/담당자</p>
        <p className="mt-2 text-3xl font-bold tabular-nums leading-none text-slate-950">
          {stats.contactCount.toLocaleString("ko-KR")}
        </p>
        <p className="mt-auto pt-3 text-xs text-slate-500">전체DB 기준 현재 담당자</p>
      </Link>

      <Link href="/dashboard/trainings" className={`${CARD_CLASS} transition hover:ring-2 hover:ring-okestro-200`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">교육 참석 이력</p>
        <p className="mt-2 text-3xl font-bold tabular-nums leading-none text-slate-950">
          {stats.trainingAttendeeCount.toLocaleString("ko-KR")}
        </p>
        <p className="mt-auto pt-3 text-xs text-slate-500">누적 교육 참석 이력</p>
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
      ? "bg-violet-50 text-violet-800 ring-violet-100"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800 ring-amber-100"
        : tone === "teal"
          ? "bg-teal-50 text-teal-800 ring-teal-100"
          : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${toneClass}`}>
      {label} {count.toLocaleString("ko-KR")}
    </span>
  );
}
