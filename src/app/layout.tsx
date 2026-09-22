import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Work Hub",
  description: "독립 업무 일계표 및 개인 워크스페이스",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body style={{ margin: 0 }}>{children}</body></html>;
}
