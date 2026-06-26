import Link from "next/link";
import { ContactsTable, type ContactTableRow } from "@/components/contacts/contacts-table";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { getContactAssignmentLabel } from "@/lib/contacts/display";
import { createClient } from "@/lib/supabase/server";
import { isSamplePartner, isSamplePartnerName } from "@/lib/partners/sample-filter";
import type { PartnerContact } from "@/types/partner";

type SearchParams = {
  q?: string;
  role?: string;
  partnerId?: string;
};

type ContactRow = PartnerContact & {
  partner?: { company_name: string } | { company_name: string }[] | null;
};

export default async function ContactsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const partnerId = (params.partnerId ?? "").trim();

  const [{ data, error }, partnerResult] = await Promise.all([
    supabase
      .from("partner_contacts")
      .select(
        "id, partner_id, name, department, position, role_type, role_raw, email, phone, is_primary, is_contract_contact, source_file, last_synced_at, memo, created_at, partner:partners(company_name)"
      )
      .order("is_contract_contact", { ascending: false })
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false }),
    partnerId
      ? supabase.from("partners").select("id, company_name").eq("id", partnerId).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const partnerFilter = partnerResult.data;
  const allRows = ((data ?? []) as unknown) as ContactRow[];
  const q = (params.q ?? "").trim().toLowerCase();
  const role = params.role ?? "all";

  const contacts = allRows.filter((row) => {
    if (partnerId && row.partner_id !== partnerId) return false;

    const partner = Array.isArray(row.partner) ? row.partner[0] : row.partner;
    if (isSamplePartnerName(partner?.company_name)) return false;
    const matchesRole =
      role === "all"
        ? true
        : role === "contract_contact"
          ? row.is_contract_contact
          : (row.role_type ?? "etc") === role;
    const haystack = [partner?.company_name, row.name, row.email, row.phone]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesQuery = q ? haystack.includes(q) : true;
    return matchesRole && matchesQuery;
  });

  const exportRows = contacts.map((row) => {
    const partner = Array.isArray(row.partner) ? row.partner[0] : row.partner;
    return {
      회사명: partner?.company_name ?? "",
      이름: row.name,
      담당구분: getContactAssignmentLabel({
        role_type: row.role_type,
        role_raw: row.role_raw,
        is_contract_contact: row.is_contract_contact
      }),
      부서: row.department ?? "",
      직급: row.position ?? "",
      연락처: row.phone ?? "",
      이메일: row.email ?? ""
    };
  });

  const tableRows: ContactTableRow[] = contacts.map((row) => {
    const partner = Array.isArray(row.partner) ? row.partner[0] : row.partner;
    return {
      id: row.id,
      partner_id: row.partner_id,
      name: row.name,
      company_name: partner?.company_name ?? "-",
      role_type: row.role_type,
      department: row.department,
      position: row.position,
      phone: row.phone,
      email: row.email,
      is_contract_contact: row.is_contract_contact
    };
  });

  const filterLabel =
    partnerFilter && !isSamplePartner(partnerFilter)
      ? partnerFilter.company_name
      : partnerId
        ? "선택한 파트너"
        : null;

  return (
    <>
      <PageHeader
        title="인력/담당자 현황"
        description="파트너사별 담당자와 계약담당자를 한눈에 확인합니다."
      />

      {partnerId && filterLabel ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">{filterLabel}</span> 담당자만 표시 중
          </p>
          <Link
            href="/dashboard/contacts"
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
          >
            필터 해제
          </Link>
        </div>
      ) : null}

      <form className="mb-5 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-nowrap">
        {partnerId ? <input type="hidden" name="partnerId" value={partnerId} /> : null}
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder={
            filterLabel
              ? `${filterLabel} 담당자 이름, 이메일, 연락처 검색`
              : "회사명, 이름, 이메일, 연락처 검색"
          }
          className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600"
        />
        <select
          name="role"
          defaultValue={role}
          className="w-44 shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체 담당구분</option>
          <option value="contract_contact">계약담당자</option>
          <option value="sales">영업</option>
          <option value="engineer">엔지니어</option>
          <option value="admin">관리</option>
          <option value="executive">대표/경영</option>
          <option value="etc">일반 담당자</option>
        </select>
        <button className="shrink-0 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          검색
        </button>
      </form>

      <div className="mb-3 text-xs text-slate-500">
        총 <span className="font-semibold text-slate-700">{contacts.length}</span>명의 담당자가
        조회되었습니다.
        {filterLabel ? (
          <>
            {" "}
            · 필터: <span className="font-semibold text-slate-700">{filterLabel}</span>
          </>
        ) : null}
      </div>

      {error ? (
        <EmptyState title="담당자 목록을 불러오지 못했습니다." description={error.message} />
      ) : contacts.length === 0 ? (
        <EmptyState
          title="조회된 담당자가 없습니다."
          description={
            filterLabel
              ? `${filterLabel}에 등록된 담당자가 없거나 검색 조건과 일치하지 않습니다.`
              : "파트너 기본정보 업로드 후 담당자 업로드를 실행하면 이 화면에 반영됩니다."
          }
        />
      ) : (
        <ContactsTable rows={tableRows} csvRows={exportRows} />
      )}
    </>
  );
}
