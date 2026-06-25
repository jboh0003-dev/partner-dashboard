import { PageHeader } from "@/components/layout/page-header";
import { DataQualityDashboard } from "@/components/data-quality/data-quality-dashboard";
import { fetchDataQualityBundle } from "@/lib/data/data-quality";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DataQualityPage() {
  const bundle = await fetchDataQualityBundle();

  return (
    <>
      <PageHeader
        title="데이터 품질 점검"
        description="파트너 DB, 문서, 담당자, 장비/리소스, 교육 데이터의 누락·불일치·확인 필요 항목을 한 화면에서 점검합니다."
      />

      <div className="mb-6 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">관리자용 점검 화면</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          이 화면은 데이터 누락·불일치를 조회하는 용도입니다. 일반 업무 메뉴에는 노출되지 않으며,
          각 항목의 <span className="font-semibold">바로가기</span> 버튼으로 파트너 상세·문서 관리 등
          수정 화면으로 이동할 수 있습니다.
        </p>
      </div>

      <DataQualityDashboard bundle={bundle} />
    </>
  );
}
