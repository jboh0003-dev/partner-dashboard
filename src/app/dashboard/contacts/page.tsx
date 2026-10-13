import Link from "next/link";
import {
  buildContactViewHref,
  CONTACT_VIEW_LABEL,
  parseContactListView
} from "@/lib/contacts/contact-views";
import { ContactSummaryCards } from "@/components/contacts/contact-summary-cards";
import { ContactsAdminTable } from "@/components/contacts/contacts-admin-table";
import { ContactsLoadError } from "@/components/contacts/contacts-load-error";
import { PageHeader } from "@/components/layout/page-header";
import {
  buildContactsCountLabel,
  fetchBouncedContactIds,
  fetchContactsList,
  fetchContactsQuickStats,
  normalizeContactsRoleFilter
} from "@/lib/contacts/contacts-list-query";
import { getContactAssignmentLabel } from "@/lib/contacts/display";
import { collectDisplayRoleLabels } from "@/lib/contacts/role-labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedViewerAuthContext } from "@/lib/auth/require-admin";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import { isSamplePartnerName } from "@/lib/partners/sample-filter";

type SearchParams = {
  q?: string;
  role?: string;
  position?: string;
  partnerId?: string;
  regionGroup?: string;
  region?: string;
  view?: string;
};

export default async function ContactsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const authPromise = getCachedViewerAuthContext();
  const partnerId = (params.partnerId ?? "").trim();
  const position = (params.position ?? "").trim();
  const regionGroup = (params.regionGroup ?? "").trim();
  const region = (params.region ?? "").trim();
  const view = parseContactListView(params.view);
  const role = normalizeContactsRoleFilter(params.role);
  const q = (params.q ?? "").trim();

  const canReuseDefaultListForActiveCount =
    view === "all" &&
    !partnerId &&
    !q &&
    role === "all" &&
    !position &&
    !regionGroup &&
    !region;

  let loadError: string | null = null;
  let contacts = [] as Awaited<ReturnType<typeof fetchContactsList>>["rows"];
  let listTotal = 0;
  let stats = { activeCount: 0, reviewCount: 0, error: null as string | null };
  let partnerOptions: Array<{ id: string; company_name: string }> = [];

  try {
    const supabase = createAdminClient();
    const bouncedContactIds =
      view === "bounced" ? await fetchBouncedContactIds(supabase) : undefined;

    const [listResult, quickStats, partnersResult] = await Promise.all([
      fetchContactsList(supabase, {
        view,
        partnerId: partnerId || undefined,
        q: q || undefined,
        role,
        position: position || undefined,
        regionGroup: regionGroup || undefined,
        region: region || undefined,
        bouncedContactIds
      }),
      canReuseDefaultListForActiveCount
        ? Promise.resolve({
            activeCount: 0,
            reviewCount: 0,
            excludedCount: 0,
            error: null as string | null
          })
        : fetchContactsQuickStats(supabase),
      supabase
        .from("partners")
        .select("id, company_name")
        .is("deleted_at", null)
        .or("is_active.is.null,is_active.eq.true")
        .order("company_name")
        .limit(5000)
    ]);

    if (listResult.error) {
      loadError = listResult.error;
    } else {
      contacts = listResult.rows;
      listTotal = listResult.total;
    }

    if (quickStats.error && !loadError) {
      loadError = quickStats.error;
    }
    stats = canReuseDefaultListForActiveCount
      ? { ...quickStats, activeCount: listResult.rows.length }
      : quickStats;

    if (partnersResult.error && !loadError) {
      loadError = partnersResult.error.message;
    } else {
      partnerOptions = ((partnersResult.data ?? []) as Array<{ id: string; company_name: string }>)
        .filter((partner) => !isSamplePartnerName(partner.company_name))
        .map((partner) => ({ id: partner.id, company_name: partner.company_name }));
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "담당자 목록 조회 중 오류가 발생했습니다.";
  }

  const { isAdmin } = await authPromise;

  const exportRows = contacts.map((row) => ({
    파트너번호:
      formatPartnerNo({ external_no: row.partner_no }) === "-"
        ? ""
        : formatPartnerNo({ external_no: row.partner_no }),
    회사명: row.company_name,
    광역권: row.region_group ?? "",
    지역: row.region ?? "",
    이름: row.name,
    직급: row.position ?? "",
    담당구분:
      collectDisplayRoleLabels(row.role_labels).join(", ") || getContactAssignmentLabel(row),
    부서: row.department ?? "",
    연락처: row.display_phone ?? row.phone ?? "",
    이메일: row.email ?? ""
  }));

  const countLabel = buildContactsCountLabel({
    total: listTotal,
    view,
    q,
    role,
    position,
    regionGroup,
    region,
    partnerId
  });

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
          href={buildContactViewHref("inactive", { q })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
        >
          비활성/제외 인원 보기
        </Link>
      </div>

      {view !== "all" ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <p className="text-sm text-violet-950">
            현재 보기: <span className="font-semibold">{CONTACT_VIEW_LABEL[view]}</span>
          </p>
          <Link
            href="/dashboard/contacts"
            className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
          >
            현재 인력으로 돌아가기
          </Link>
        </div>
      ) : null}

      {view !== "merge" ? (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <form className="flex w-full flex-wrap items-center gap-3 lg:flex-nowrap">
            {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}
            <input
              name="q"
              defaultValue={q}
              placeholder="회사명, 이름, 이메일, 연락처 검색"
              className="min-w-[260px] flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600"
            />
            {q ? (
              <Link
                href={view === "all" ? "/dashboard/contacts" : `/dashboard/contacts?view=${view}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                검색 초기화
              </Link>
            ) : null}
            <button className="shrink-0 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              검색
            </button>
          </form>

          <div className="mt-3 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{countLabel}</span>
            {" · "}
            각 열 제목 옆 필터 아이콘에서 실제 열 값들을 체크해 필요한 항목만 볼 수 있습니다.
          </div>

          <ContactsAdminTable
            rows={contacts}
            totalCount={listTotal}
            countLabel={countLabel}
            csvRows={exportRows}
            partnerOptions={partnerOptions}
            defaultPartnerId={partnerId || undefined}
            embedded
            showReviewReason={view === "review"}
            isAdmin={isAdmin}
          />
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          중복 병합은 업로드 시 자동 처리됩니다.{" "}
          <Link href="/dashboard/contacts" className="font-semibold text-okestro-600 hover:underline">
            현재 인력 목록으로 돌아가기
          </Link>
        </div>
      )}
    </>
  );
}
