import Link from "next/link";
import { ArrowRight, Building2, FileText, GraduationCap, TrendingUp } from "lucide-react";

const ACTIONS = [
  {
    href: "/dashboard/partners",
    title: "파트너 관리",
    description: "파트너 목록과 정보를 바로 확인",
    icon: Building2,
    iconClass: "bg-blue-50 text-blue-700 ring-blue-100"
  },
  {
    href: "/dashboard/documents",
    title: "문서 관리",
    description: "계약서·신청서·정책자료 확인",
    icon: FileText,
    iconClass: "bg-emerald-50 text-emerald-700 ring-emerald-100"
  },
  {
    href: "/dashboard/trainings",
    title: "교육 현황",
    description: "교육 신청과 참석 이력 확인",
    icon: GraduationCap,
    iconClass: "bg-violet-50 text-violet-700 ring-violet-100"
  },
  {
    href: "/dashboard/performance",
    title: "파이프라인 상세",
    description: "영업기회와 수주예상 상세 조회",
    icon: TrendingUp,
    iconClass: "bg-amber-50 text-amber-700 ring-amber-100"
  }
] as const;

export function DashboardQuickActions() {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-slate-950">빠른 실행</h2>
        <span className="text-[11px] font-medium text-slate-400">자주 쓰는 메뉴</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              prefetch={false}
              className="group flex min-h-[104px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/45 p-3.5 transition hover:-translate-y-0.5 hover:border-okestro-200 hover:bg-white hover:shadow-sm"
            >
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${action.iconClass}`}
              >
                <Icon size={20} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-950">{action.title}</span>
                <span className="mt-1 block text-[11px] font-medium leading-4 text-slate-500">
                  {action.description}
                </span>
              </span>
              <ArrowRight
                size={16}
                className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-okestro-600"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
