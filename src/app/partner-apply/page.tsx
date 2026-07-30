import { PartnerApplyWizard } from "@/components/partner-apply/partner-apply-wizard";

export const metadata = {
  title: "오케스트로 파트너 신청",
  description: "파트너 신청 포털"
};

export default function PartnerApplyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-10">
      <PartnerApplyWizard />
    </main>
  );
}
