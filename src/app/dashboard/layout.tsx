import "./oke-answer.css";
import "./workhub-theme.css";
import { OkePanelProvider } from "@/components/search/oke-panel-context";
import { DashboardContent } from "@/components/search/dashboard-content";
import { SidebarSession } from "@/components/layout/sidebar-session";
import { PartnerSearchWidget } from "@/components/search/partner-search-widget";

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <OkePanelProvider>
      <div className="connect-atelier min-h-screen bg-[rgb(var(--background))]">
        <SidebarSession />
        <DashboardContent>{children}</DashboardContent>
        <PartnerSearchWidget />
      </div>
    </OkePanelProvider>
  );
}
