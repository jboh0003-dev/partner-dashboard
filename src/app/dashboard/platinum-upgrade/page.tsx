import { PageHeader } from "@/components/layout/page-header";
import { PlatinumUpgradePanel } from "@/components/platinum-upgrade/platinum-upgrade-panel";

export default function PlatinumUpgradePage() {
  return (
    <>
      <PageHeader
        title="플래티넘 승급"
        description="파트너를 선택하고 플래티넘 부속합의서를 생성합니다. 생성 시 등급이 Platinum으로 변경됩니다."
      />
      <PlatinumUpgradePanel />
    </>
  );
}
