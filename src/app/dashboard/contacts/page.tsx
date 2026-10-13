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

type PartnerFilterRow = {
  id: string;
  company_name: string;
  external_no: string | null;
  region_group: string | null;
  region: string | null;
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
    .sort((a, b) => a.localeCompare(b, "ko-KR"));
}

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
  const hrefParams = {
    q: params.q,
    role: params.role,
    position,
    partnerId,
    regionGroup,
    region
  };
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
  let partnerFilterRows: PartnerFilterRow[] = [];
  let positionOptions: string[] = [];

  try {
    const supabase = createAdminClient();

    const bouncedContactIds =
      view === "bounced" ? await fetchBouncedContactIds(supabase) : undefined;

    const [listResult, quickStats, partnersResult, positionsResult] = await Promise.all([
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
        .select("id, company_name, external_no, region_group, region")
        .is("deleted_at", null)
        .or("is_active.is.null,is_active.eq.true")
        .order("company_name")
        .limit(5000),
      supabase
        .from("partner_contacts")
        .select("position")
        .eq("is_active", true)
        .is("deleted_at", null)
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
      partnerFilterRows = ((partnersResult.data ?? []) as PartnerFilterRow[]).filter(
        (partner) => !isSamplePartnerName(partner.company_name)
      );
    }

    if (positionsResult.error && !loadError) {
      loadError = positionsResult.error.message;
    } else {
      positionOptions = uniqueSorted(
        (positionsResult.data ?? []).map((row) => row.position as string | null)
      );
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : "담당자 목록 조회 중 오류가 발생했습니다.";
  }

  const { isAdmin } = await authPromise;

  const partnerOptions = partnerFilterRows.map((partner) => ({
    id: partner.id,
    company_name: partner.company_name
  }));
  const regionGroupOptions = uniqueSorted(
    partnerFilterRows.map((partner) => partner.region_group)
  );
  const regionOptions = uniqueSorted(
    partnerFilterRows.map((partner) => partner.region)
  );
  const selectedPartner = partnerFilterRows.find((partner) => partner.id === partnerId) ?? null;

  const exportRows = contacts.map((row) => ({
    파트너번호:
      formatPartnerNo({ external_no: row.partner_no }) === "-"
        ? ""
        : formatPartnerNo({ external_no: row.partner_no }),
    회사명: row.company_name,
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

  const hasFilters = Boolean(
    q ||
      partnerId ||
      role !== "all" ||
      position ||
      regionGroup ||
      region ||
      view !== "all"
  );

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

      {view !== "merge" ? (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <form>
            {view !== "all" ? <input type="hidden" name="view" value={view} /> : null}

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
              <input
                name="q"
                defaultValue={q}
                placeholder="이름, 이메일, 연락처 검색"
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 xl:col-span-2"
              />

              <select
                name="partnerId"
                defaultValue={partnerId}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">전체 파트너</option>
                {partnerFilterRows.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.company_name}
                  </option>
                ))}
              </select>

              <select
                name="regionGroup"
                defaultValue={regionGroup}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">전체 광역권</option>
                {regionGroupOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <select
                name="region"
                defaultValue={region}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">전체 지역</option>
                {regionOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <select
                name="position"
                defaultValue={position}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="">전체 직급</option>
                {positionOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>

              <select
                name="role"
                defaultValue={role}
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
              >
                <option value="all">전체 담당구분</option>
                <option value="contract_contact">담당자</option>
                <option value="sales">영업</option>
                <option value="engineer">엔지니어</option>
                <option value="admin">관리</option>
                <option value="executive">대표/경영</option>
                <option value="etc">일반 담당자</option>
              </select>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {listTotal > 0 ? (
                  <span className="font-semibold text-slate-700">{countLabel}</span>
                ) : (
                  <>조건에 맞는 담당자가 없습니다.</>
                )}
              </div>

              <div className="flex items-center gap-2">
                {hasFilters ? (
                  <Link
                    href="/dashboard/contacts"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    필터 초기화
                  </Link>
                ) : null}
                <button className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                  필터 적용
                </button>
              </div>
            </div>
          </form>

          {hasFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>필터:</span>
              {selectedPartner ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                  파트너 {selectedPartner.company_name}
                </span>
              ) : null}
              {regionGroup ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                  광역권 {regionGroup}
                </span>
              ) : null}
              {region ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                  지역 {region}
                </span>
              ) : null}
              {position ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                  직급 {position}
                </span>
              ) : null}
              {role !== "all" ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">
                  담당구분 {role}
                </span>
              ) : null}
              {view !== "all" ? (
                <span className="rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-800">
                  {CONTACT_VIEW_LABEL[view]}
                </span>
              ) : null}
            </div>
          ) : null}

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
          <Link
            href={buildContactsClearFilterHref(hrefParams)}
            className="font-semibold text-okestro-600 hover:underline"
          >
            현재 인력 목록으로 돌아가기
          </Link>
        </div>
      )}
    </>
  );
}
