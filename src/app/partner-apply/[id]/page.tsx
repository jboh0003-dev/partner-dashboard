import { PartnerApplyWizard } from "@/components/partner-apply/partner-apply-wizard";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function PartnerApplyResumePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-10">
      <PartnerApplyWizard initialId={id} initialToken={token} />
    </main>
  );
}
