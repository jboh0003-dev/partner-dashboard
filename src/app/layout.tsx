import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partner Dashboard",
  description: "Internal partner management dashboard"
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
