import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partner Connect",
  description: "OKESTRO 파트너 정보·교육·문서·실적을 연결하는 Partner Connect",
  applicationName: "Partner Connect",
  openGraph: {
    title: "Partner Connect",
    description: "OKESTRO 파트너 정보·교육·문서·실적을 연결하는 Partner Connect",
    siteName: "Partner Connect",
    locale: "ko_KR",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
