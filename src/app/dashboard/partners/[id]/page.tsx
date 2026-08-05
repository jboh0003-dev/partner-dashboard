import { notFound } from "next/navigation";
import { AnimatedSection } from "@/components/common/animated-section";
import { PageHeader } from "@/components/layout/page-header";
import { PartnerDetailTabs } from "@/components/partners/partner-detail-tabs";
import { fetchPartnerDetailBundle } from "@/lib/data/partner-detail";
import { getDisplayPartnerGradeLabel } from "@/lib/partners/grade";
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
  // TODO(auth): 추후 admin/user 권한 적용 예정
  const isAdmin = true;

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
      <AnimatedSection>
        <PageHeader
          title={p.company_name}
          description="파트너 통합 정보 — 기본정보, 이력, PoC, 장비, 문서를 한곳에서 조회합니다."
        />
      </AnimatedSection>

      <section className="ui-stagger mb-6 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        <SummaryCard label="파트너번호" value={formatPartnerNo(p)} index={0} />
        <SummaryCard label="등급" value={getDisplayPartnerGradeLabel(p)} index={1} />
        <SummaryCard
          label="계약일자"
          value={p.contract_start_date ? formatDate(p.contract_start_date) : "-"}
          index={2}
        />
        <SummaryCard label={fourthCardLabel} value={fourthCardValue} index={3} />
      </section>

      <AnimatedSection delayMs={120}>
        <PartnerDetailTabs
          bundle={bundle}
          addNoteAction={addPartnerNote}
          initialTab={tab}
          isAdmin={isAdmin}
        />
      </AnimatedSection>
    </>
  );
}

function SummaryCard({
  label,
  value,
  index
}: {
  label: string;
  value: React.ReactNode;
  index: number;
}) {
  return (
    <div
      className="ui-enter-item ui-card min-w-[200px] p-4"
      style={{ ["--enter-index" as string]: index }}
    >
      <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 truncate text-lg font-semibold tracking-tight text-slate-950">
        {value}
      </div>
    </div>
  );
}
