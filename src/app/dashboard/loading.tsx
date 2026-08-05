import {
  DetailCardsSkeleton,
  KpiGridSkeleton,
  PageHeaderSkeleton,
  TableSkeleton
} from "@/components/common/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5 p-1" aria-busy aria-label="로딩 중">
      <div className="ui-enter">
        <div className="h-28 animate-pulse rounded-xl bg-slate-200/80" />
      </div>
      <div className="ui-enter" style={{ ["--enter-delay" as string]: "50ms" }}>
        <KpiGridSkeleton />
      </div>
      <div className="ui-enter" style={{ ["--enter-delay" as string]: "100ms" }}>
        <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-slate-100/80" />
      </div>
      <div className="ui-enter" style={{ ["--enter-delay" as string]: "150ms" }}>
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100/70" />
      </div>
    </div>
  );
}

export function PartnersListLoading() {
  return (
    <div className="space-y-5" aria-busy>
      <PageHeaderSkeleton />
      <div className="ui-toolbar">
        <div className="h-10 flex-1 animate-pulse rounded-lg bg-slate-200/70" />
        <div className="h-10 w-44 animate-pulse rounded-lg bg-slate-200/70" />
        <div className="h-10 w-20 animate-pulse rounded-lg bg-slate-200/70" />
      </div>
      <TableSkeleton rows={10} cols={7} />
    </div>
  );
}

export function ContactsListLoading() {
  return (
    <div className="space-y-5" aria-busy>
      <PageHeaderSkeleton />
      <KpiGridSkeleton count={1} />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}

export function PartnerDetailLoading() {
  return (
    <div className="space-y-5" aria-busy>
      <PageHeaderSkeleton />
      <DetailCardsSkeleton />
      <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-slate-200/70" />
      <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100/80" />
    </div>
  );
}
