import type { ReactNode } from "react";

export const TABLE_NAME_CLASS =
  "block min-w-[10rem] max-w-[18rem] truncate whitespace-nowrap font-medium text-slate-900";

export const TABLE_LINK_NAME_CLASS =
  "block min-w-[10rem] max-w-[18rem] truncate whitespace-nowrap font-semibold text-okestro-600 hover:text-okestro-700 hover:underline";

export const TABLE_TEXT_CLASS =
  "block min-w-[7rem] break-keep whitespace-normal text-slate-700";

export const TABLE_SPEC_CLASS =
  "block min-w-[8rem] max-w-[22rem] break-keep whitespace-normal text-slate-700";

export function TableText({
  value,
  className = TABLE_TEXT_CLASS,
  fallback = "-",
  style
}: {
  value: string | null | undefined;
  className?: string;
  fallback?: string;
  style?: React.CSSProperties;
}) {
  const text = value?.trim() ? value.trim() : fallback;
  return (
    <span className={className} title={text !== fallback ? text : undefined} style={style}>
      {text}
    </span>
  );
}

export function TableName({
  children,
  title,
  className = TABLE_NAME_CLASS
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span className={className} title={title}>
      {children}
    </span>
  );
}
