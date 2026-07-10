import type { ReactNode } from "react";

export const TABLE_NAME_CLASS =
  "block min-w-[10rem] max-w-[18rem] truncate whitespace-nowrap font-medium text-slate-900 select-text";

export const TABLE_LINK_NAME_CLASS =
  "block min-w-[10rem] max-w-[18rem] truncate whitespace-nowrap font-semibold text-okestro-600 hover:text-okestro-700 hover:underline select-text";

export const TABLE_TEXT_CLASS =
  "block min-w-[7rem] break-keep whitespace-normal text-slate-700 select-text";

export const TABLE_SPEC_CLASS =
  "block min-w-[8rem] max-w-[22rem] break-keep whitespace-normal text-slate-700 select-text";

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

/** 좁은 컬럼에서 한 글자씩 세로 줄바꿈 방지 */
export function TableNowrap({
  value,
  className = "min-w-[5rem]",
  fallback = "-"
}: {
  value: string | null | undefined;
  className?: string;
  fallback?: string;
}) {
  const text = value?.trim() ? value.trim() : fallback;
  return (
    <span
      className={`block whitespace-nowrap text-slate-700 select-text ${className}`}
      title={text !== fallback ? text : undefined}
    >
      {text}
    </span>
  );
}

/** 긴 텍스트 2줄 + 말줄임 */
export function TableClamp2({
  value,
  className = "min-w-[10rem] max-w-[20rem]",
  fallback = "-"
}: {
  value: string | null | undefined;
  className?: string;
  fallback?: string;
}) {
  const text = value?.trim() ? value.trim() : fallback;
  return (
    <span
      className={`block line-clamp-2 break-words text-slate-700 select-text ${className}`}
      title={text !== fallback ? text : undefined}
    >
      {text}
    </span>
  );
}
