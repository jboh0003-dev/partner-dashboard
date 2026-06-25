import type { ReactNode } from "react";

type FilterToolbarProps = {
  children: ReactNode;
  className?: string;
};

/** 목록 화면 상단 필터/검색 영역 */
export function FilterToolbar({ children, className = "" }: FilterToolbarProps) {
  return (
    <div className={["ui-toolbar", className].filter(Boolean).join(" ")}>{children}</div>
  );
}
