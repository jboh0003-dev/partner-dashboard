import Link from "next/link";
import { AnimatedSection } from "@/components/common/animated-section";
import { PageHeader } from "@/components/layout/page-header";
import { PartnerAdminTable } from "@/components/partners/partner-admin-table";
import { EmptyState } from "@/components/common/empty-state";
import { createClient } from "@/lib/supabase/server";
import { partnerListRowsToCsv } from "@/lib/partners/list";
import { fetchPartnersList } from "@/lib/partners/partners-list-query";
import { getCachedViewerAuthContext } from "@/lib/auth/require-admin";

type SearchParams = {
  q?: string;
  partnerId?: string;
  grade?: string;
  regionGroup?: string;
  region?: string;
  contractYear?: string;
  contractMonth?: string;
  includeExcluded?: string;
};

export default async function PartnersPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [auth, result] = await Promise.all([
    getCachedViewerAuthContext(),
    fetchPartnersList(supabase, params)
  ]);
  const isAdmin = auth.isAdmin;
  const {
    rows,
    totalCount,
    includeExcluded,
    excludedCount,
    error: partnersError
  } = result;

  const exportRows = partnerListRowsToCsv(rows);
  const hasSearch = Boolean((params.q ?? "").trim() || includeExcluded);

  return (
    <>
      <AnimatedSection>
        <PageHeader
          title="파트너 DB"
          action={
            isAdmin ? (
              <Link
                href="/dashboard/partners/new"
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                수동 등록
              </Link>
            ) : undefined
          }
        />
      </AnimatedSection>

      <AnimatedSection delayMs={50}>
        <form className="ui-toolbar mb-4 lg:flex-nowrap">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="회사명, 파트너번호, 담당자, 이메일, 연락처 검색"
            className="ui-input min-w-[260px] flex-1"
          />
          <label className="flex shrink-0 items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              name="includeExcluded"
              value="1"
              defaultChecked={includeExcluded}
              className="rounded border-slate-300"
            />
            통계 제외 포함
          </label>
          {hasSearch ? (
            <Link
              href="/dashboard/partners"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              초기화
            </Link>
          ) : null}
          <button type="submit" className="ui-btn-accent shrink-0">
            검색
          </button>
        </form>
        <div className="mb-3 text-xs text-slate-500">
          각 열 제목 옆 필터 아이콘에서 실제 열 값들을 체크해 필요한 항목만 볼 수 있습니다.
          {includeExcluded && excludedCount > 0 ? ` · 통계 제외 포함 ${excludedCount}개` : ""}
        </div>
      </AnimatedSection>

      <AnimatedSection delayMs={100}>
        {partnersError ? (
          <EmptyState title="파트너 목록을 불러오지 못했습니다." description={partnersError} />
        ) : totalCount === 0 ? (
          <EmptyState
            title="조건에 맞는 파트너사가 없습니다."
            description="검색 조건을 변경하거나 초기화해 주세요."
          />
        ) : (
          <PartnerAdminTable rows={rows} csvRows={exportRows} isAdmin={isAdmin} />
        )}
      </AnimatedSection>
    </>
  );
}
