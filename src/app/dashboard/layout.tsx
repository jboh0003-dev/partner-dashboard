import { OkePanelProvider } from "@/components/search/oke-panel-context";
import { DashboardContent } from "@/components/search/dashboard-content";
import { Sidebar } from "@/components/layout/sidebar";
import { PartnerSearchWidget } from "@/components/search/partner-search-widget";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <OkePanelProvider>
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <Sidebar userEmail={user?.email ?? null} />
        <DashboardContent>{children}</DashboardContent>
        <PartnerSearchWidget />
      </div>
    </OkePanelProvider>
  );
}
