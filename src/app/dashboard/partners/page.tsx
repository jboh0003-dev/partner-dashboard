import Link from "next/link";
import { AnimatedSection } from "@/components/common/animated-section";
import { PageHeader } from "@/components/layout/page-header";
import { PartnerAdminTable } from "@/components/partners/partner-admin-table";
import { EmptyState } from "@/components/common/empty-state";
import { createClient } from "@/lib/supabase/server";
import { partnerListRowsToCsv } from "@/lib/partners/list";
import { fetchPartnersList } from "@/lib/partners/partners-list-query";

type SearchParams = {
  q?: string;
  grade?: string;
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
  const result = await fetchPartnersList(supabase, params);
  const {
    rows,
    totalCount,
    includeExcluded,
    excludedCount,
    error: partnersError,
    gradeToken
  } = result;

  const exportRows = partnerListRowsToCsv(rows);

  return (
    <>
      <AnimatedSection>
        <PageHeader
          title="파트너 DB"
          action={
            <Link
              href="/dashboard/partners/new"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              수동 등록
            </Link>
          }
        />
      </AnimatedSection>

      <AnimatedSection delayMs={50}>
        <form className="ui-toolbar mb-5 lg:flex-nowrap">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="회사명, 파트너번호, 등급, 담당자, 이메일, 연락처 검색"
            className="ui-input min-w-[220px] flex-1"
          />
          <select
            name="grade"
            defaultValue={params.grade ?? "all"}
            className="ui-select w-44 shrink-0"
          >
            <option value="all">전체 등급</option>
            <option value="Platinum">Platinum</option>
            <option value="Service Partner">Service Partner</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="strategic">Strategic</option>
            <option value="none">미분류</option>
          </select>
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
          <button type="submit" className="ui-btn-accent shrink-0">
            검색
          </button>
        </form>
      </AnimatedSection>

      {(params.contractYear || params.contractMonth || gradeToken || includeExcluded) && (
        <AnimatedSection delayMs={80} className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>필터 적용:</span>
          {gradeToken ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">등급 {params.grade}</span>
          ) : null}
          {params.contractYear ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{params.contractYear}년 신규 계약</span>
          ) : null}
          {params.contractMonth ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{params.contractMonth} 신규 계약</span>
          ) : null}
          {includeExcluded ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
              통계 제외 포함{excludedCount > 0 ? ` (${excludedCount})` : ""}
            </span>
          ) : null}
          <Link href="/dashboard/partners" className="font-semibold text-okestro-600 hover:underline">필터 해제</Link>
        </AnimatedSection>
      )}

      <AnimatedSection delayMs={100}>
        {partnersError ? (
          <EmptyState title="파트너 목록을 불러오지 못했습니다." description={partnersError} />
        ) : totalCount === 0 ? (
          <EmptyState title="등록된 파트너사가 없습니다." description="파트너를 직접 등록하거나 업로드 화면에서 데이터를 먼저 반영하세요." />
        ) : (
          <PartnerAdminTable rows={rows} csvRows={exportRows} />
        )}
      </AnimatedSection>
    </>
  );
}
