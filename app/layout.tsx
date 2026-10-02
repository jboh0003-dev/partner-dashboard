import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "BokDesk",
  description: "Personal Work Hub",
  applicationName: "BokDesk",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
