import { BrandLoading } from "@/components/common/brand-loading";
import {
  DetailCardsSkeleton,
  KpiGridSkeleton,
  TableSkeleton
} from "@/components/common/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5 p-1" aria-busy aria-label="로딩 중">
      <div className="ui-enter">
        <BrandLoading message="파트너 정보를 불러오고 있습니다." />
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
      <BrandLoading message="요청하신 정보를 불러오고 있습니다." />
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
      <BrandLoading message="요청하신 정보를 불러오고 있습니다." />
      <KpiGridSkeleton count={1} />
      <TableSkeleton rows={10} cols={6} />
    </div>
  );
}

export function PartnerDetailLoading() {
  return (
    <div className="space-y-5" aria-busy>
      <BrandLoading message="요청하신 정보를 불러오고 있습니다." />
      <DetailCardsSkeleton />
      <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-slate-200/70" />
      <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-slate-100/80" />
    </div>
  );
}
