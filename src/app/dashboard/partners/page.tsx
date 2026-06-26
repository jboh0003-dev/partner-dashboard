import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PartnerTable } from "@/components/partners/partner-table";
import { EmptyState } from "@/components/common/empty-state";
import { createClient } from "@/lib/supabase/server";
import { filterSamplePartners } from "@/lib/partners/sample-filter";
import {
  buildPartnerListRows,
  filterPartnerListRows,
  partnerListRowsToCsv
} from "@/lib/partners/list";
import type { Partner, PartnerContact } from "@/types/partner";

type SearchParams = {
  q?: string;
  grade?: string;
};

export default async function PartnersPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("partners").select("*");

  if (params.grade && params.grade !== "all") {
    query = query.eq("grade", params.grade);
  }

  const { data: partnersData, error: partnersError } = await query;
  const partners = filterSamplePartners((partnersData ?? []) as Partner[]);

  const partnerIds = partners.map((partner) => partner.id);
  let contacts: PartnerContact[] = [];

  if (partnerIds.length > 0) {
    const { data: contactsData } = await supabase
      .from("partner_contacts")
      .select("*")
      .in("partner_id", partnerIds);
    contacts = (contactsData ?? []) as PartnerContact[];
  }

  const allRows = buildPartnerListRows(partners, contacts);
  const rows = filterPartnerListRows(allRows, params.q);
  const exportRows = partnerListRowsToCsv(rows);

  return (
    <>
      <PageHeader
        title="파트너 DB"
        description="파트너사 기본 정보와 주담당자 연락처를 빠르게 확인합니다."
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
          placeholder="회사명, 담당자명, 연락처, 이메일 검색"
          className="ui-input min-w-[220px] flex-1"
        />
        <select name="grade" defaultValue={params.grade ?? "all"} className="ui-select w-44 shrink-0">
          <option value="all">전체 등급</option>
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="strategic">Strategic</option>
          <option value="none">미분류</option>
        </select>
        <button type="submit" className="ui-btn-accent shrink-0">
          검색
        </button>
      </form>

      <div className="mb-3 text-xs text-slate-500">
        총 <span className="font-semibold text-slate-700">{rows.length}</span>개의
        파트너사가 검색되었습니다.
      </div>

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
        <PartnerTable rows={rows} csvRows={exportRows} />
      )}
    </>
  );
}
