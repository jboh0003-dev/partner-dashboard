import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Partner Hub",
  description: "Internal partner management hub"
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
