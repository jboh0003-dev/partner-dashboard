"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function PendingIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs">
      <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
      <span className="sr-only">화면 이동 중</span>
    </span>
  );
}

export function NavigationLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<PendingIndicator /></Link>;
}
