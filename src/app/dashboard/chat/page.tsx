import { PageHeader } from "@/components/layout/page-header";
import { SearchChat } from "@/components/search/search-chat";
import { OKE_MENU_LABEL, OKE_SUBTITLE, OKE_NAME } from "@/lib/search/oke-branding";

export default function PartnerChatPage() {
  return (
    <>
      <PageHeader title={OKE_MENU_LABEL} description={OKE_SUBTITLE} />
      <SearchChat variant="page" />
    </>
  );
}
