import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PartnerDetailTabs } from "@/components/partners/partner-detail-tabs";
import { getViewerRole } from "@/lib/auth/require-admin";
import { fetchPartnerDetailBundle } from "@/lib/data/partner-detail";
import { PARTNER_GRADE_LABEL } from "@/lib/constants";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import { formatDate } from "@/lib/utils";
import { addPartnerNote } from "./actions";

export default async function PartnerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const bundle = await fetchPartnerDetailBundle(id);
  const isAdmin = (await getViewerRole()) === "admin";

  if (!bundle) {
    notFound();
  }

  const p = bundle.partner;
  const fourthCardLabel = p.sales_owner?.trim() ? "영업담당자" : "최종 업데이트";
  const fourthCardValue = p.sales_owner?.trim()
    ? p.sales_owner
    : formatDate(p.updated_at);

  return (
    <>
      <PageHeader
        title={p.company_name}
        description="파트너 통합 정보 — 기본정보, 이력, PoC, 장비, 문서를 한곳에서 조회합니다."
      />

      <section className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <SummaryCard label="파트너번호" value={formatPartnerNo(p)} />
        <SummaryCard
          label="등급"
          value={PARTNER_GRADE_LABEL[p.grade ?? "none"] ?? p.grade ?? "-"}
        />
        <SummaryCard
          label="계약일자"
          value={p.contract_start_date ? formatDate(p.contract_start_date) : "-"}
        />
        <SummaryCard label={fourthCardLabel} value={fourthCardValue} />
      </section>

      <PartnerDetailTabs
        bundle={bundle}
        addNoteAction={addPartnerNote}
        initialTab={tab}
        isAdmin={isAdmin}
      />
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ui-card min-w-[200px] p-4">
      <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 truncate text-lg font-semibold tracking-tight text-slate-950">
        {value}
      </div>
    </div>
  );
}
