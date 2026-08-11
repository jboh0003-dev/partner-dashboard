import "./oke-answer.css";
import { OkePanelProvider } from "@/components/search/oke-panel-context";
import { DashboardContent } from "@/components/search/dashboard-content";
import { Sidebar } from "@/components/layout/sidebar";
import { PartnerSearchWidget } from "@/components/search/partner-search-widget";
import { getCachedAuthEmail } from "@/lib/auth/session";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const email = await getCachedAuthEmail();

  return (
    <OkePanelProvider>
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <Sidebar userEmail={email} />
        <DashboardContent>{children}</DashboardContent>
        <PartnerSearchWidget />
      </div>
    </OkePanelProvider>
  );
}
