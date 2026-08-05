import Link from "next/link";

export const DEFAULT_PAGE_SIZE = 25;

export function parsePageParam(raw: string | undefined | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function clampPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  return Math.min(Math.max(1, page), totalPages);
}

export function totalPagesFor(totalCount: number, pageSize: number): number {
  if (totalCount <= 0 || pageSize <= 0) return 0;
  return Math.ceil(totalCount / pageSize);
}

export function rangeForPage(page: number, pageSize: number): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/** Page numbers with ellipsis: 1 … 4 5 6 … 20 */
export function buildPageItems(
  current: number,
  totalPages: number
): Array<number | "ellipsis"> {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: Array<number | "ellipsis"> = [];
  const push = (v: number | "ellipsis") => {
    if (items[items.length - 1] === v) return;
    items.push(v);
  };

  push(1);
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) push("ellipsis");
  for (let p = start; p <= end; p += 1) push(p);
  if (end < totalPages - 1) push("ellipsis");
  push(totalPages);
  return items;
}

type PaginationProps = {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize?: number;
  /** Build href for a page number while preserving filters */
  buildHref: (page: number) => string;
  className?: string;
};

export function ListPagination({
  page,
  totalPages,
  totalCount,
  pageSize = DEFAULT_PAGE_SIZE,
  buildHref,
  className = ""
}: PaginationProps) {
  if (totalCount === 0) {
    return (
      <p className={`mt-4 text-center text-sm text-slate-500 ${className}`.trim()}>
        표시할 항목이 없습니다.
      </p>
    );
  }

  if (totalPages <= 1) {
    return (
      <p className={`mt-4 text-center text-xs text-slate-500 ${className}`.trim()}>
        전체 {totalCount.toLocaleString("ko-KR")}건
      </p>
    );
  }

  const items = buildPageItems(page, totalPages);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <nav
      className={`mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between ${className}`.trim()}
      aria-label="목록 페이지"
    >
      <p className="text-xs text-slate-500">
        {from.toLocaleString("ko-KR")}–{to.toLocaleString("ko-KR")} / 전체{" "}
        {totalCount.toLocaleString("ko-KR")}건
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <PaginationLink href={page > 1 ? buildHref(page - 1) : null} disabled={page <= 1}>
          이전
        </PaginationLink>
        {items.map((item, idx) =>
          item === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-2 text-sm text-slate-400" aria-hidden>
              …
            </span>
          ) : (
            <PaginationLink
              key={item}
              href={item === page ? null : buildHref(item)}
              active={item === page}
              ariaCurrent={item === page ? "page" : undefined}
            >
              {item}
            </PaginationLink>
          )
        )}
        <PaginationLink
          href={page < totalPages ? buildHref(page + 1) : null}
          disabled={page >= totalPages}
        >
          다음
        </PaginationLink>
      </div>
    </nav>
  );
}

function PaginationLink({
  href,
  children,
  disabled,
  active,
  ariaCurrent
}: {
  href: string | null;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  ariaCurrent?: "page";
}) {
  const base =
    "inline-flex min-w-[2rem] items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-medium transition";
  if (disabled || !href) {
    return (
      <span
        className={`${base} ${
          active
            ? "bg-slate-900 text-white"
            : "cursor-not-allowed text-slate-300"
        }`}
        aria-current={ariaCurrent}
        aria-disabled={disabled || undefined}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} text-slate-700 hover:bg-slate-100`}
      prefetch={false}
      scroll={false}
    >
      {children}
    </Link>
  );
}
