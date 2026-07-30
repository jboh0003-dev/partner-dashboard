export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-1">
      <div className="h-28 animate-pulse rounded-xl bg-slate-200/80" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-xl bg-slate-200/60" />
      <div className="h-64 animate-pulse rounded-xl bg-slate-200/50" />
    </div>
  );
}
