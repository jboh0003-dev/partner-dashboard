import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PartnerAdminTable } from "@/components/partners/partner-admin-table";
import { EmptyState } from "@/components/common/empty-state";
import { createClient } from "@/lib/supabase/server";
import {
  filterOfficialPartnerStatsPartners,
  isExcludedFromOfficialPartnerStats
} from "@/lib/partners/official-stats-exclude";
import { filterSamplePartners } from "@/lib/partners/sample-filter";
import {
  getDisplayPartnerGrade,
  parseGradeQueryParam
} from "@/lib/partners/grade";
import {
  buildPartnerListRows,
  filterPartnerListRows,
  partnerListRowsToCsv
} from "@/lib/partners/list";
import type { Partner, PartnerContact } from "@/types/partner";

type SearchParams = {
  q?: string;
  grade?: string;
  contractYear?: string;
  contractMonth?: string;
  /** 1이면 통계 제외(딜 전용) 회사도 목록에 포함 */
  includeExcluded?: string;
};

function parseContractDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function filterPartnersByQuery(
  partners: Partner[],
  params: SearchParams
): Partner[] {
  let filtered = partners;

  const gradeToken = parseGradeQueryParam(params.grade);
  if (gradeToken) {
    filtered = filtered.filter(
      (partner) => getDisplayPartnerGrade(partner) === gradeToken
    );
  }

  if (params.contractYear) {
    const year = Number(params.contractYear);
    if (Number.isFinite(year)) {
      filtered = filtered.filter((partner) => {
        const date = parseContractDate(partner.contract_start_date);
        return date?.getFullYear() === year;
      });
    }
  }

  if (params.contractMonth) {
    const match = /^(\d{4})-(\d{1,2})$/.exec(params.contractMonth.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      filtered = filtered.filter((partner) => {
        const date = parseContractDate(partner.contract_start_date);
        return date?.getFullYear() === year && date.getMonth() + 1 === month;
      });
    }
  }

  return filtered;
}

export default async function PartnersPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const includeExcluded =
    params.includeExcluded === "1" || params.includeExcluded === "true";

  const { data: partnersData, error: partnersError } = await supabase
    .from("partners")
    .select("*")
    .is("deleted_at", null);

  const activePartners = filterSamplePartners((partnersData ?? []) as Partner[]).filter(
    (partner) => partner.is_active !== false
  );
  const officialPartners = includeExcluded
    ? activePartners
    : filterOfficialPartnerStatsPartners(activePartners);
  const excludedCount = activePartners.filter((partner) =>
    isExcludedFromOfficialPartnerStats(partner)
  ).length;
  const partners = filterPartnersByQuery(officialPartners, params);

  const partnerIds = partners.map((partner) => partner.id);
  let contacts: PartnerContact[] = [];

  if (partnerIds.length > 0) {
    const { data: contactsData } = await supabase
      .from("partner_contacts")
      .select("*")
      .in("partner_id", partnerIds)
      .eq("is_active", true)
      .is("deleted_at", null);
    contacts = (contactsData ?? []) as PartnerContact[];
  }

  const allRows = buildPartnerListRows(partners, contacts);
  const rows = filterPartnerListRows(allRows, params.q, contacts);
  const exportRows = partnerListRowsToCsv(rows);
  const gradeToken = parseGradeQueryParam(params.grade);

  return (
    <>
      <PageHeader
        title="파트너 DB"
        action={
          <Link
            href="/dashboard/partners/new"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            파트너 등록
          </Link>
        }
      />

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

      {(params.contractYear || params.contractMonth || gradeToken || includeExcluded) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span>필터 적용:</span>
          {gradeToken ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
              등급 {params.grade}
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
          <Link href="/dashboard/partners" className="font-semibold text-okestro-600 hover:underline">
            필터 해제
          </Link>
        </div>
      )}

      {partnersError ? (
        <EmptyState
          title="파트너 목록을 불러오지 못했습니다."
          description={partnersError.message}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="등록된 파트너사가 없습니다."
          description="파트너를 직접 등록하거나 업로드 화면에서 데이터를 먼저 반영하세요."
        />
      ) : (
        <PartnerAdminTable rows={rows} csvRows={exportRows} />
      )}
    </>
  );
}
