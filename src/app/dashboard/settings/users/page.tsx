import { PageHeader } from "@/components/layout/page-header";
import { UsersAdminPanel } from "@/components/settings/users-admin-panel";
import { requireAdminPage } from "@/lib/auth/require-admin-page";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  await requireAdminPage();
  return (
    <div className="p-6">
      <PageHeader title="계정 관리" description="사내 사용자 계정을 추가하고 역할을 관리합니다." />
      <UsersAdminPanel />
    </div>
  );
}
