import "./oke-answer.css";
import { OkePanelProvider } from "@/components/search/oke-panel-context";
import { DashboardContent } from "@/components/search/dashboard-content";
import { Sidebar } from "@/components/layout/sidebar";
import { PartnerSearchWidget } from "@/components/search/partner-search-widget";
import { displayRoleLabel } from "@/lib/auth/roles";
import { getCachedViewerAuthContext } from "@/lib/auth/require-admin";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await getCachedViewerAuthContext();
  const email = auth.profile?.email ?? auth.user?.email ?? null;
  const name = auth.profile?.name ?? null;

  return (
    <OkePanelProvider>
      <div className="min-h-screen bg-[rgb(var(--background))]">
        <Sidebar
          userEmail={email}
          userName={name}
          roleLabel={displayRoleLabel(auth.isAdmin ? "admin" : auth.role)}
          isAdmin={auth.isAdmin}
        />
        <DashboardContent>{children}</DashboardContent>
        <PartnerSearchWidget />
      </div>
    </OkePanelProvider>
  );
}
