import Link from "next/link";
import { buildContactViewHref } from "@/lib/contacts/contact-views";

type ContactsPaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  hrefParams: {
    view?: string;
    q?: string;
    role?: string;
    partnerId?: string;
  };
};

export function ContactsPagination({
  page,
  totalPages,
  total,
  pageSize,
  hrefParams
}: ContactsPaginationProps) {
  if (totalPages <= 1) return null;

  const view = (hrefParams.view ?? "all") as Parameters<typeof buildContactViewHref>[0];
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);

  function pageHref(targetPage: number) {
    const search = new URLSearchParams();
    if (view !== "all") search.set("view", view);
    if (hrefParams.q?.trim()) search.set("q", hrefParams.q.trim());
    if (hrefParams.role && hrefParams.role !== "all") search.set("role", hrefParams.role);
    if (hrefParams.partnerId?.trim()) search.set("partnerId", hrefParams.partnerId.trim());
    search.set("page", String(targetPage));
    return `/dashboard/contacts?${search.toString()}`;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
      <p>
        전체 <span className="font-semibold text-slate-800">{total.toLocaleString("ko-KR")}</span>건
        중 {from.toLocaleString("ko-KR")}–{to.toLocaleString("ko-KR")} 표시
      </p>
      <div className="flex items-center gap-2">
        <PaginationLink href={pageHref(prevPage)} disabled={page <= 1} label="이전" />
        <span className="px-2 text-xs tabular-nums text-slate-500">
          {page} / {totalPages}
        </span>
        <PaginationLink href={pageHref(nextPage)} disabled={page >= totalPages} label="다음" />
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  disabled,
  label
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-slate-100 px-3 py-1.5 text-xs text-slate-300">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
    >
      {label}
    </Link>
  );
}
