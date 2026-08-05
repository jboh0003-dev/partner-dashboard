import type { CSSProperties, HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  className?: string;
};

/** Lightweight pulse placeholder — no shadcn dependency. */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/80 ${className}`.trim()}
      aria-hidden
      {...props}
    />
  );
}

export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="ui-enter-item flex min-h-[9.25rem] flex-col rounded-xl border border-slate-200 bg-white p-5"
          style={{ "--enter-index": i } as CSSProperties}
        >
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-9 w-24" />
          <Skeleton className="mt-auto h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 8,
  cols = 6
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="ui-table-shell overflow-hidden" aria-busy>
      <div className="border-b border-slate-100 bg-slate-50/90 px-5 py-3">
        <div className="flex gap-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-16" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 px-5 py-3.5">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-3.5 ${c === 0 ? "w-28" : c === 1 ? "w-40" : "w-20"}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <section
      className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4"
      aria-busy
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ui-card min-w-[200px] p-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-3 h-6 w-28" />
        </div>
      ))}
    </section>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="mb-6" aria-busy>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
    </div>
  );
}
