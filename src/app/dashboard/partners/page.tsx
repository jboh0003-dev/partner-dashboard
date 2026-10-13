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
    error: partnersError,
    gradeToken,
    filterOptions
  } = result;

  const exportRows = partnerListRowsToCsv(rows);
  const selectedPartner = filterOptions.partners.find(
    (partner) => partner.id === params.partnerId
  );
  const hasFilters = Boolean(
    params.q ||
      params.partnerId ||
      gradeToken ||
      params.regionGroup ||
      params.region ||
      params.contractYear ||
      params.contractMonth ||
      includeExcluded
  );

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
        <form className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          {params.contractYear ? (
            <input type="hidden" name="contractYear" value={params.contractYear} />
          ) : null}
          {params.contractMonth ? (
            <input type="hidden" name="contractMonth" value={params.contractMonth} />
          ) : null}

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="검색"
              className="ui-input xl:col-span-2"
            />

            <select
              name="partnerId"
              defaultValue={params.partnerId ?? ""}
              className="ui-select"
            >
              <option value="">전체 파트너</option>
              {filterOptions.partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.company_name}
                </option>
              ))}
            </select>

            <select
              name="grade"
              defaultValue={params.grade ?? "all"}
              className="ui-select"
            >
              <option value="all">전체 등급</option>
              <option value="Platinum">Platinum</option>
              <option value="Service Partner">Service Partner</option>
              <option value="Gold">Gold</option>
              <option value="Silver">Silver</option>
              <option value="strategic">Strategic</option>
              <option value="none">미분류</option>
            </select>

            <select
              name="regionGroup"
              defaultValue={params.regionGroup ?? ""}
              className="ui-select"
            >
              <option value="">전체 광역권</option>
              {filterOptions.regionGroups.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              name="region"
              defaultValue={params.region ?? ""}
              className="ui-select"
            >
              <option value="">전체 지역</option>
              {filterOptions.regions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                name="includeExcluded"
                value="1"
                defaultChecked={includeExcluded}
                className="rounded border-slate-300"
              />
              통계 제외 포함
            </label>

            <div className="flex items-center gap-2">
              {hasFilters ? (
                <Link
                  href="/dashboard/partners"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  필터 초기화
                </Link>
              ) : null}
              <button type="submit" className="ui-btn-accent">
                필터 적용
              </button>
            </div>
          </div>
        </form>
      </AnimatedSection>

      {hasFilters ? (
        <AnimatedSection
          delayMs={80}
          className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600"
        >
          <span>필터 적용:</span>
          {selectedPartner ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
              파트너 {selectedPartner.company_name}
            </span>
          ) : null}
          {gradeToken ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
              등급 {params.grade}
            </span>
          ) : null}
          {params.regionGroup ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
              광역권 {params.regionGroup}
            </span>
          ) : null}
          {params.region ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
              지역 {params.region}
            </span>
          ) : null}
          {params.contractYear ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
              {params.contractYear}년 신규 계약
            </span>
          ) : null}
          {params.contractMonth ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
              {params.contractMonth} 신규 계약
            </span>
          ) : null}
          {includeExcluded ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
              통계 제외 포함{excludedCount > 0 ? ` (${excludedCount})` : ""}
            </span>
          ) : null}
        </AnimatedSection>
      ) : null}

      <AnimatedSection delayMs={100}>
        {partnersError ? (
          <EmptyState title="파트너 목록을 불러오지 못했습니다." description={partnersError} />
        ) : totalCount === 0 ? (
          <EmptyState
            title="조건에 맞는 파트너사가 없습니다."
            description="필터 조건을 변경하거나 초기화해 주세요."
          />
        ) : (
          <PartnerAdminTable rows={rows} csvRows={exportRows} isAdmin={isAdmin} />
        )}
      </AnimatedSection>
    </>
  );
}
