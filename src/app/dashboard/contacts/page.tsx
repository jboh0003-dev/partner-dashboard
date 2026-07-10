import Link from "next/link";
import {
  buildContactViewHref,
  buildContactsClearFilterHref,
  CONTACT_VIEW_LABEL,
  parseContactListView
} from "@/lib/contacts/contact-views";
import { ContactSummaryCards } from "@/components/contacts/contact-summary-cards";
import { ContactsAdminTable } from "@/components/contacts/contacts-admin-table";
import { ContactsLoadError } from "@/components/contacts/contacts-load-error";
import { ContactsPagination } from "@/components/contacts/contacts-pagination";
import { PageHeader } from "@/components/layout/page-header";
import {
  CONTACTS_PAGE_SIZE_DEFAULT,
  fetchBouncedContactIds,
  fetchContactsListPage,
  fetchContactsQuickStats,
  normalizeContactsRoleFilter
} from "@/lib/contacts/contacts-list-query";
import { getContactAssignmentLabel } from "@/lib/contacts/display";
import { collectDisplayRoleLabels } from "@/lib/contacts/role-labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import { isSamplePartner, isSamplePartnerName } from "@/lib/partners/sample-filter";

type SearchParams = {
  q?: string;
  role?: string;
  partnerId?: string;
  view?: string;
  page?: string;
};

export default async function ContactsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const partnerId = (params.partnerId ?? "").trim();
  const view = parseContactListView(params.view);
  const hrefParams = { q: params.q, role: params.role, partnerId };
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const role = normalizeContactsRoleFilter(params.role);
  const q = (params.q ?? "").trim();

  let loadError: string | null = null;
  let contacts = [] as Awaited<ReturnType<typeof fetchContactsListPage>>["rows"];
  let listMeta = {
    total: 0,
    page: 1,
    pageSize: CONTACTS_PAGE_SIZE_DEFAULT,
    totalPages: 0
  };
  let stats = { activeCount: 0, reviewCount: 0, error: null as string | null };
  let partnerOptions: Array<{ id: string; company_name: string }> = [];
  let partnerFilter: { id: string; company_name: string } | null = null;

  try {
    const supabase = createAdminClient();

    const bouncedContactIds =
      view === "bounced" ? await fetchBouncedContactIds(supabase) : undefined;

    const [listResult, quickStats, partnersResult, partnerResult] = await Promise.all([
      fetchContactsListPage(supabase, {
        view,
        page,
        pageSize: CONTACTS_PAGE_SIZE_DEFAULT,
        partnerId: partnerId || undefined,
        q: q || undefined,
        role,
        bouncedContactIds
      }),
      fetchContactsQuickStats(supabase),
      supabase
        .from("partners")
        .select("id, company_name")
        .is("deleted_at", null)
        .order("company_name")
        .limit(500),
      partnerId
        ? supabase.from("partners").select("id, company_name").eq("id", partnerId).maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    if (listResult.error) {
      loadError = listResult.error;
    } else {
      contacts = listResult.rows;
      listMeta = {
        total: listResult.total,
        page: listResult.page,
        pageSize: listResult.pageSize,
        totalPages: listResult.totalPages
      };
    }

    if (quickStats.error && !loadError) {
      loadError = quickStats.error;
    }
    stats = quickStats;

    if (partnersResult.error && !loadError) {
      loadError = partnersResult.error.message;
    } else {
      partnerOptions = ((partnersResult.data ?? []) as Array<{ id: string; company_name: string }>)
        .filter((partner) => !isSamplePartnerName(partner.company_name))
        .map((partner) => ({ id: partner.id, company_name: partner.company_name }));
    }

    partnerFilter = partnerResult.data as { id: string; company_name: string } | null;
  } catch (error) {
    loadError = error instanceof Error ? error.message : "담당자 목록 조회 중 오류가 발생했습니다.";
  }

  // auth session 문제는 목록 로딩을 막지 않음 (admin client 사용)
  try {
    await createClient();
  } catch {
    // ignore auth warmup errors
  }

  const exportRows = contacts.map((row) => ({
    파트너번호:
      formatPartnerNo({ external_no: row.partner_no }) === "-"
        ? ""
        : formatPartnerNo({ external_no: row.partner_no }),
    회사명: row.company_name,
    이름: row.name,
    담당구분:
      collectDisplayRoleLabels(row.role_labels).join(", ") || getContactAssignmentLabel(row),
    "부서/직급": [row.department, row.position].filter(Boolean).join(" / "),
    연락처: row.display_phone ?? row.phone ?? "",
    이메일: row.email ?? ""
  }));

  const filterLabel =
    partnerFilter && !isSamplePartner(partnerFilter)
      ? partnerFilter.company_name
      : partnerId
        ? "선택한 파트너"
        : null;

  if (loadError) {
    return (
      <>
        <PageHeader
          title="인력/담당자 현황"
          description="파트너사별 담당자를 사람 기준으로 통합 표시합니다."
        />
        <ContactsLoadError message={loadError} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="인력/담당자 현황"
        description="파트너사별 담당자를 사람 기준으로 통합 표시합니다."
      />

      <ContactSummaryCards activeCount={stats.activeCount} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <Link
          href={buildContactViewHref("inactive", hrefParams)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
        >
          비활성/제외 인원 보기
        </Link>
      </div>

      {view !== "all" ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-sm text-violet-950">
            현재 필터: <span className="font-semibold">{CONTACT_VIEW_LABEL[view]}</span>
          </p>
          <Link
            href={buildContactsClearFilterHref(hrefParams)}
            className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
          >
            필터 해제
          </Link>
        </div>
      ) : null}

      {partnerId && filterLabel ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">{filterLabel}</span> 담당자만 표시 중
          </p>
          <Link
            href={buildContactViewHref(view, { q: params.q, role: params.role })}
            className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
          >
            파트너 필터 해제
          </Link>
        </div>
      ) : null}

      {view === "merge" ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          중복 병합은 업로드 시 자동 처리됩니다.{" "}
          <Link href={buildContactsClearFilterHref(hrefParams)} className="font-semibold text-okestro-600 hover:underline">
            현재 인력 목록으로 돌아가기
          </Link>
        </div>
      ) : null}

      {view !== "merge" ? (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <form className="flex w-full flex-wrap items-center gap-3 lg:flex-nowrap">
            {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
            {partnerId ? <input type="hidden" name="partnerId" value={partnerId} /> : null}
            <input
              name="q"
              defaultValue={q}
              placeholder={
                filterLabel
                  ? `${filterLabel} · 이름, 이메일, 연락처 검색`
                  : "이름, 이메일, 연락처, 부서/직급 검색"
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

          <div className="mt-3 text-xs text-slate-500">
            {listMeta.total > 0 ? (
              <>
                전체{" "}
                <span className="font-semibold text-slate-700">
                  {listMeta.total.toLocaleString("ko-KR")}
                </span>
                명 중{" "}
                <span className="font-semibold text-slate-700">
                  {contacts.length.toLocaleString("ko-KR")}
                </span>
                명 표시
              </>
            ) : (
              <>조건에 맞는 담당자가 없습니다.</>
            )}
            {view !== "all" ? (
              <>
                {" "}
                · 보기:{" "}
                <span className="font-semibold text-slate-700">{CONTACT_VIEW_LABEL[view]}</span>
              </>
            ) : null}
            {filterLabel ? (
              <>
                {" "}
                · 파트너: <span className="font-semibold text-slate-700">{filterLabel}</span>
              </>
            ) : null}
          </div>

          <ContactsAdminTable
            rows={contacts}
            totalCount={listMeta.total}
            csvRows={exportRows}
            partnerOptions={partnerOptions}
            defaultPartnerId={partnerId || undefined}
            embedded
            showReviewReason={view === "review"}
          />

          <ContactsPagination
            page={listMeta.page}
            totalPages={listMeta.totalPages}
            total={listMeta.total}
            pageSize={listMeta.pageSize}
            hrefParams={{ view: view !== "all" ? view : undefined, q, role, partnerId }}
          />
        </div>
      ) : null}
    </>
  );
}
