import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Work Hub',
  description: 'Personal work dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
