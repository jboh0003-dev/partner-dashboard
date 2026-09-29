import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Work Hub",
  description: "일계표, 업무 캘린더, 메모, 라이브센터를 한 곳에서 관리하는 개인 Work Hub",
  applicationName: "Work Hub",
  openGraph: {
    title: "Work Hub",
    description: "일계표, 업무 캘린더, 메모, 라이브센터를 한 곳에서 관리하는 개인 Work Hub",
    siteName: "Work Hub",
    locale: "ko_KR",
    type: "website",
  },
};

export default function WorkHubLayout({ children }: { children: ReactNode }) {
  return children;
}
