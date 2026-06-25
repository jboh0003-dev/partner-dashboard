import { OkePanelProvider } from "@/components/search/oke-panel-context";
import { DashboardContent } from "@/components/search/dashboard-content";
import { Sidebar } from "@/components/layout/sidebar";
import { PartnerSearchWidget } from "@/components/search/partner-search-widget";

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OkePanelProvider>
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <Sidebar />
        <DashboardContent>{children}</DashboardContent>
        <PartnerSearchWidget />
      </div>
    </OkePanelProvider>
  );
}
