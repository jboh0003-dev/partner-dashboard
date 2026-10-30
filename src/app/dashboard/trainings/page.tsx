import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { EducationStatusExcelButton } from "@/components/trainings/education-status-excel-button";
import { TrainingAttendeesTable } from "@/components/trainings/training-attendees-table";
import { TrainingRecruitmentPanel } from "@/components/trainings/training-recruitment-panel";
import { TrainingTabs } from "@/components/trainings/training-tabs";
import { createClient } from "@/lib/supabase/server";
import {
  buildMonthOptions as buildRecruitmentMonthOptions,
  buildRecruitmentRows,
  parseMonthsParam,
  parseRecruitmentAudience,
  parseRecruitmentContactRole,
  type RecruitmentFilters
} from "@/lib/trainings/recruitment";
import { parseCourseTagsParam } from "@/lib/trainings/course-tags";
import { fetchRecruitmentSourceData } from "@/lib/data/training-recruitment";
import {
  formatAttendanceStatus,
  formatTrainingGroupLabel,
  formatTrainingProduct,
  isTechPartnerTraining,
  parseTrainingGroupKey,
  trainingGroupKey
} from "@/lib/training-display";
import { formatTrainingTypeLabel } from "@/lib/training/constants";
import { monthlyAttendeeUniqueKey } from "@/lib/trainings/attendance-stats";
import { buildAnnualTrainingKpis, TRAINING_KPI_YEAR } from "@/lib/trainings/annual-attendance-summary";
import {
  AnnualTrainingDetails,
  isAnnualKpiView
} from "@/components/trainings/annual-training-details";
import { fetchAllRows } from "@/lib/imports/fetch-all-rows";
import {
  buildEducationOverview,
  dedupeTrainingAttendanceRows,
  filterOfficialTrainingAttendees,
  type MonthlyEducationSummary,
  type YearlyEducationSummary
} from "@/lib/trainings/overview-stats";
import { getCachedViewerAuthContext } from "@/lib/auth/require-admin";
import { getRealPartnerIdSet } from "@/lib/partners/sample-filter";
import {
  EDUCATION_STATUS_ATTENDANCE_SELECT,
  filterEducationStatusAttendees,
  flattenAttendeeRows,
  type EducationStatusAttendeeRow
} from "@/lib/trainings/education-status-export";
import type { Partner } from "@/types/partner";
import type { Training } from "@/types/training";

type SearchParams = {
  tab?: string;
  year?: string;
  view?: string;
  partner?: string;
  person?: string;
  q?: string;
  month?: string;
  training?: string;
  audience?: string;
  months?: string | string[];
  attended_tags?: string | string[];
  not_attended_tags?: string | string[];
  new_partner_since?: string;
  grade?: string;
  contract_from?: string;
  contract_to?: string;
  contact_role?: string;
};

type AttendeeDetailRow = EducationStatusAttendeeRow;

type RegistrationRow = {
  id: string;
  company_name_raw: string;
  attendee_name: string;
  attendee_department: string | null;
  attendee_position: string | null;
  attendee_phone: string | null;
  attendee_email: string | null;
  registration_status: string;
  match_status: string | null;
  review_reason: string | null;
  training: {
    id: string;
    training_name: string;
    product: string | null;
    start_date: string | null;
    training_year: number | null;
    training_month: number | null;
  } | null;
  partner: {
    id: string;
    company_name: string;
    external_no: string | null;
  } | null;
};

export default async function TrainingsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = parseTrainingTab(params.tab);
  const { isAdmin } = await getCachedViewerAuthContext();
  const supabase = await createClient();

  const [
    { data: trainingsData, error: trainingsError },
    attendanceDetailResult,
    { data: partnersData, error: partnersError }
  ] = await Promise.all([
    supabase
      .from("trainings")
      .select("*")
      .is("deleted_at", null)
      .order("training_year", { ascending: false, nullsFirst: false })
      .order("training_month", { ascending: false, nullsFirst: false })
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("training_attendance")
        .select(EDUCATION_STATUS_ATTENDANCE_SELECT)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to)
    )
      .then((data) => ({ data, error: null as { message: string } | null }))
      .catch((error: unknown) => ({
        data: null,
        error: { message: error instanceof Error ? error.message : "참석 이력 조회 실패" }
      })),
    supabase.from("partners").select("id, company_name, external_no, memo").is("deleted_at", null)
  ]);

  const attendanceDetailData = attendanceDetailResult.data;
  const attendanceDetailError = attendanceDetailResult.error;
  const fetchError =
    trainingsError?.message ?? attendanceDetailError?.message ?? partnersError?.message ?? null;

  const realPartnerIds = getRealPartnerIdSet((partnersData ?? []) as Partner[]);
  const trainings = (trainingsData ?? []) as Training[];
  const activeTrainingIds = new Set(trainings.map((training) => training.id));
  const countedAttendees = dedupeTrainingAttendanceRows(
    filterOfficialTrainingAttendees(
      flattenAttendeeRows(attendanceDetailData),
      realPartnerIds,
      activeTrainingIds
    )
  );
  const allAttendees = countedAttendees;
  const { monthly: summaryRows, yearly: yearlyRows } = buildEducationOverview(
    trainings,
    countedAttendees
  );
  const summarySelectedYear = yearlyRows.some((row) => String(row.year) === params.year)
    ? Number(params.year)
    : yearlyRows[0]?.year ?? null;
  const monthOptions = buildMonthOptions(trainings);
  const trainingOptions = buildTrainingOptions(trainings, params.month);
  const filteredAttendees = filterEducationStatusAttendees(allAttendees, params);
  // Dashboard KPIs always describe 2026, independent of historical summary filters.
  const kpi = buildAnnualTrainingKpis(countedAttendees, TRAINING_KPI_YEAR);
  const showKpiDetail =
    tab === "attendees" &&
    params.year === String(TRAINING_KPI_YEAR) &&
    isAnnualKpiView(params.view);

  const registrationResult =
    tab === "registrations"
      ? await supabase
          .from("training_registrations")
          .select(
            "id, company_name_raw, attendee_name, attendee_department, attendee_position, attendee_phone, attendee_email, registration_status, match_status, review_reason, training:trainings(id, training_name, product, start_date, training_year, training_month), partner:partners(id, company_name, external_no)"
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5000)
      : { data: [], error: null };

  const registrationRows = ((registrationResult.data ?? []) as unknown as RegistrationRow[])
    .filter((row) => {
      const q = (params.q ?? "").trim().toLowerCase();
      if (!q) return true;
      return [
        row.company_name_raw,
        row.attendee_name,
        row.attendee_department,
        row.attendee_position,
        row.attendee_phone,
        row.attendee_email,
        row.training?.training_name,
        row.training?.product
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });

  const recruitmentSource =
    tab === "recruitment" ? await fetchRecruitmentSourceData() : null;
  const recruitmentFilters = parseRecruitmentFilters(params);
  const recruitmentRows = recruitmentSource
    ? buildRecruitmentRows(recruitmentSource, recruitmentFilters)
    : [];
  const recruitmentMonthOptions = recruitmentSource
    ? buildRecruitmentMonthOptions(recruitmentSource.trainings)
    : [];

  const attendeeExportRows = filteredAttendees.map((row) => ({
    파트너사: row.partner_name,
    이름: row.attendee_name,
    교육연월: formatTrainingGroupLabel(
      row.training_year,
      row.training_month,
      isTechPartnerTraining(row)
    ),
    교육구분: isTechPartnerTraining(row)
      ? "기술파트너 교육"
      : formatTrainingTypeLabel(row.training_type),
    교육명: row.training_name,
    교육레벨: row.training_level ?? "",
    제품: formatTrainingProduct(row.product, null),
    직급: row.attendee_position ?? "",
    직무: row.attendee_department ?? "",
    휴대폰: row.attendee_phone ?? "",
    이메일: row.attendee_email ?? "",
    참석상태: formatAttendanceStatus(row.attended, row.attendance_status),
    수료여부: row.completion_status ?? "",
    점수: row.score ?? "",
    평가결과: row.evaluation_result ?? ""
  }));

  const techTrainings = trainings.filter((t) =>
    t.training_year === TRAINING_KPI_YEAR && /기술파트너/.test(t.training_name)
  );

  return (
    <>
      <PageHeader
        title="교육 현황"
        description={
          tab === "recruitment"
            ? "조건 조합으로 교육 모객 대상 파트너와 담당자 이메일을 추출합니다."
            : "정기교육 월별 요약과 참석자 이력을 조회합니다."
        }
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-start">
            {isAdmin && tab !== "recruitment" && !showKpiDetail ? (
              <EducationStatusExcelButton
                q={tab === "attendees" ? params.q : undefined}
                month={tab === "attendees" ? params.month : "all"}
                training={tab === "attendees" ? params.training : "all"}
              />
            ) : null}
            <UploadHintLink
              href="/dashboard/upload?type=training_registrations"
              title="교육 신청 DB 업로드"
              hint="MS Forms 응답 Excel을 그대로 자동 정리"
            />
            <UploadHintLink
              href="/dashboard/upload?type=training_attendance_detail"
              title="정기교육 참석자 업로드"
              hint="특정 정기교육 회차의 실제 참석자 반영"
            />
            <UploadHintLink
              href="/dashboard/trainings/tech-partner-upload"
              title="기술파트너 교육 업로드"
              hint="교육 출석 + 이론평가 + 기술평가 결과를 반영"
            />
          </div>
        }
      />

      {techTrainings.length > 0 && tab === "summary" ? (
        <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <h2 className="text-sm font-bold text-slate-900">기술파트너 교육</h2>
          <div className="mt-3 space-y-2">
            {techTrainings.map((training) => {
              const attendeeCount = new Set(
                countedAttendees
                  .filter((row) => row.training_id === training.id)
                  .map((row) =>
                    monthlyAttendeeUniqueKey(
                      training.training_year ?? 0,
                      training.training_month ?? 0,
                      true,
                      row
                    )
                  )
              ).size;
              const examTaken = allAttendees.filter(
                (row) =>
                  row.training_id === training.id &&
                  row.evaluation_result === "응시"
              ).length;
              return (
                <div
                  key={training.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white bg-white px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{training.training_name}</p>
                    <p className="text-xs text-slate-500">
                      {training.start_date} ~ {training.end_date} · 참석 {attendeeCount}명 · 응시{" "}
                      {examTaken}건
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/trainings?tab=attendees&training=${training.id}`}
                    className="text-xs font-semibold text-okestro-600 hover:underline"
                  >
                    상세 보기
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {fetchError && tab !== "recruitment" ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          데이터 조회 중 오류가 발생했습니다: {fetchError}
        </div>
      ) : null}

      {tab !== "recruitment" ? (
        <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <KpiBox
            label="2026 참석자(중복제외)"
            value={kpi.uniqueAttendees}
            unit="명"
            hint="실제 참석자 명단"
            tone="blue"
            href="/dashboard/trainings?tab=attendees&year=2026&view=unique"
          />
          <KpiBox
            label="2026 참석자(중복포함)"
            value={kpi.totalAttendances}
            unit="건"
            hint="교육별 참석 기록 전체"
            tone="violet"
            href="/dashboard/trainings?tab=attendees&year=2026&view=all"
          />
          <KpiBox
            label="2026 참석파트너"
            value={kpi.partnerCount}
            unit="개사"
            hint="참석 파트너별 명단"
            tone="slate"
            href="/dashboard/trainings?tab=attendees&year=2026&view=partners"
          />
        </section>
      ) : null}

      <TrainingTabs active={tab} searchParams={params} />

      {tab === "summary" ? (
        <SummarySection rows={summaryRows} yearly={yearlyRows} selectedYear={summarySelectedYear} error={fetchError} />
      ) : tab === "registrations" ? (
        <RegistrationsSection
          rows={registrationRows}
          q={params.q}
          error={registrationResult.error?.message ?? null}
        />
      ) : tab === "attendees" ? (
        showKpiDetail && isAnnualKpiView(params.view) ? (
          <AnnualTrainingDetails
            data={kpi}
            view={params.view}
            partnerId={params.partner}
            personKey={params.person}
            q={params.q}
            error={fetchError}
          />
        ) : (
          <AttendeesSection
            rows={filteredAttendees}
            totalCount={allAttendees.length}
            monthOptions={monthOptions}
            trainingOptions={trainingOptions}
            params={params}
            error={attendanceDetailError?.message ?? null}
            csvRows={attendeeExportRows}
          />
        )
      ) : (
        <TrainingRecruitmentPanel
          rows={recruitmentRows}
          monthOptions={recruitmentMonthOptions}
          params={params}
          error={recruitmentSource?.error ?? null}
        />
      )}
    </>
  );
}

function parseTrainingTab(
  value: string | undefined
): "summary" | "registrations" | "attendees" | "recruitment" {
  if (value === "registrations") return "registrations";
  if (value === "attendees") return "attendees";
  if (value === "recruitment") return "recruitment";
  return "summary";
}

function parseRecruitmentFilters(params: SearchParams): RecruitmentFilters {
  return {
    audience: parseRecruitmentAudience(params.audience),
    months: parseMonthsParam(params.months),
    attended_tags: parseCourseTagsParam(params.attended_tags),
    not_attended_tags: parseCourseTagsParam(params.not_attended_tags),
    new_partner_since: params.new_partner_since,
    grade: params.grade,
    contract_from: params.contract_from,
    contract_to: params.contract_to,
    contact_role: parseRecruitmentContactRole(params.contact_role),
    q: params.q
  };
}

function SummarySection({
  rows,
  yearly,
  selectedYear,
  error
}: {
  rows: MonthlyEducationSummary[];
  yearly: YearlyEducationSummary[];
  selectedYear: number | null;
  error: string | null;
}) {
  if (error) {
    return <EmptyState title="교육 현황을 불러오지 못했습니다." description={error} />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="등록된 교육 데이터가 없습니다."
        description="정기교육 참석자 업로드 후 연도별·월별 요약이 표시됩니다."
      />
    );
  }
  const visibleRows = selectedYear ? rows.filter((row) => row.year === selectedYear) : rows;
  return (
    <>
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">연도별 교육 요약</h2>
            <p className="mt-1 text-xs text-slate-500">
              중복제외: 연간 실제 참석자 · 중복포함: 교육과정별 참석 기록 전체
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">유효 참석 기록 기준 · 원본 이력 유지</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>연도</Th>
                <Th align="right">운영월</Th>
                <Th align="right">중복제외 참석자</Th>
                <Th align="right">중복포함 참석기록</Th>
                <Th align="right">참석 파트너</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {yearly.map((row) => (
                <tr key={row.year} className={row.year === selectedYear ? "bg-blue-50/50" : "hover:bg-slate-50"}>
                  <td className="px-5 py-3.5">
                    <Link
                      href={"/dashboard/trainings?tab=summary&year=" + row.year}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {row.year}년
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums text-slate-700">{row.monthCount}개월</td>
                  <td className="px-5 py-3.5 text-right text-sm font-bold tabular-nums text-slate-950">{row.uniqueAttendees.toLocaleString("ko-KR")}명</td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums text-slate-700">{row.totalAttendances.toLocaleString("ko-KR")}건</td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums text-slate-700">{row.partnerCount.toLocaleString("ko-KR")}개사</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">월별 교육 현황</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            동일 교육연월에 여러 제품을 수강한 인원은 한 번만 계산합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {yearly.map((row) => (
            <Link
              key={row.year}
              href={"/dashboard/trainings?tab=summary&year=" + row.year}
              className={[
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                row.year === selectedYear
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
            >
              {row.year}년
            </Link>
          ))}
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>교육연월</Th>
                <Th>교육과정</Th>
                <Th align="right">중복제외 참석자</Th>
                <Th align="right">참석 파트너</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 text-sm">
                    <Link
                      href={"/dashboard/trainings?tab=attendees&month=" + encodeURIComponent(row.key)}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {row.label}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-600">{row.courseSummary}</td>
                  <td className="px-5 py-3.5 text-right text-sm font-semibold tabular-nums text-slate-900">
                    {row.attendanceCount.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-5 py-3.5 text-right text-sm tabular-nums text-slate-700">
                    {row.partnerCount.toLocaleString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function RegistrationsSection({
  rows,
  q,
  error
}: {
  rows: RegistrationRow[];
  q?: string;
  error: string | null;
}) {
  return (
    <>
      <form className="mb-5 flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="tab" value="registrations" />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="회사명, 이름, 직급, 이메일, 휴대폰, 교육명 검색"
          className="min-w-[260px] flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600"
        />
        <button className="shrink-0 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          검색
        </button>
      </form>

      {error ? (
        <EmptyState title="교육 신청 현황을 불러오지 못했습니다." description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="등록된 교육 신청이 없습니다."
          description="교육 신청 DB 업로드에서 MS Forms Excel을 올리면 자동으로 표시됩니다."
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1100px] divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>교육일</Th>
                  <Th>교육</Th>
                  <Th>파트너사</Th>
                  <Th>이름</Th>
                  <Th>직급</Th>
                  <Th>직무/부서</Th>
                  <Th>휴대폰</Th>
                  <Th>이메일</Th>
                  <Th>매칭</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-sm text-slate-700">{row.training?.start_date ?? "-"}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">
                      {row.training?.product ?? row.training?.training_name ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-800">
                      {row.partner?.company_name ?? row.company_name_raw}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{row.attendee_name}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{row.attendee_position ?? "-"}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{row.attendee_department ?? "-"}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{row.attendee_phone ?? "-"}</td>
                    <td className="px-5 py-3 text-sm text-slate-700">{row.attendee_email ?? "-"}</td>
                    <td className="px-5 py-3 text-sm">
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[11px] font-semibold",
                          row.match_status === "matched"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-800"
                        ].join(" ")}
                        title={row.review_reason ?? undefined}
                      >
                        {row.match_status === "matched" ? "자동 매칭" : "확인 필요"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function AttendeesSection({
  rows,
  totalCount,
  monthOptions,
  trainingOptions,
  params,
  error,
  csvRows
}: {
  rows: AttendeeDetailRow[];
  totalCount: number;
  monthOptions: Array<{ value: string; label: string }>;
  trainingOptions: Array<{ value: string; label: string }>;
  params: SearchParams;
  error: string | null;
  csvRows: Array<Record<string, string | number>>;
}) {
  return (
    <>
      <form className="mb-5 flex w-full flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-nowrap">
        <input type="hidden" name="tab" value="attendees" />
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="파트너사, 이름, 교육명, 이메일 검색"
          className="min-w-[240px] flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600"
        />
        <select
          name="month"
          defaultValue={params.month ?? "all"}
          className="w-44 shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
        >
          <option value="all">전체 교육연월</option>
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          name="training"
          defaultValue={params.training ?? "all"}
          disabled={(params.month ?? "all") === "all"}
          className="min-w-[180px] shrink-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="all">교육연월 선택 후 교육명</option>
          {trainingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button className="shrink-0 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          검색
        </button>
      </form>

      <div className="mb-3 text-xs text-slate-500">
        전체 <span className="font-semibold text-slate-700">{totalCount}</span>건 중{" "}
        <span className="font-semibold text-slate-700">{rows.length}</span>건이
        표시됩니다.
      </div>

      {error ? (
        <EmptyState title="참석자 목록을 불러오지 못했습니다." description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="표시할 참석자 이력이 없습니다."
          description="검색 조건을 변경하거나 정기교육 참석자 업로드 후 다시 확인해 주세요."
        />
      ) : (
        <TrainingAttendeesTable rows={rows} csvRows={csvRows} csvLabel="CSV 다운로드" />
      )}
    </>
  );
}

function buildMonthOptions(
  trainings: Training[]
): Array<{ value: string; label: string }> {
  const seen = new Map<string, string>();

  for (const training of trainings) {
    if (!training.training_year || !training.training_month) continue;
    const isTech = isTechPartnerTraining(training);
    const value = trainingGroupKey(training.training_year, training.training_month, isTech);
    seen.set(value, formatTrainingGroupLabel(training.training_year, training.training_month, isTech));
  }

  return Array.from(seen.entries())
    .sort(([a], [b]) => b.localeCompare(a, "ko-KR", { numeric: true }))
    .map(([value, label]) => ({ value, label }));
}

function buildTrainingOptions(
  trainings: Training[],
  monthFilter?: string
): Array<{ value: string; label: string }> {
  let scoped = trainings;
  if (monthFilter && monthFilter !== "all") {
    const parsed = parseTrainingGroupKey(monthFilter);
    if (parsed) {
      scoped = trainings.filter(
        (training) =>
          training.training_year === parsed.year &&
          training.training_month === parsed.month &&
          isTechPartnerTraining(training) === parsed.isTech
      );
    }
  }

  return scoped.map((training) => ({
    value: training.id,
    label: training.training_name
  }));
}


function Th({
  children,
  align = "left"
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={[
        "px-5 py-3 text-xs font-semibold text-slate-500",
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left"
      ].join(" ")}
    >
      {children}
    </th>
  );
}

function KpiBox({
  label,
  value,
  unit,
  hint,
  tone,
  href
}: {
  label: string;
  value: number;
  unit: string;
  hint: string;
  tone: "slate" | "blue" | "violet";
  href: string;
}) {
  const toneClass = {
    slate: "text-slate-900",
    blue: "text-blue-700",
    violet: "text-violet-700"
  }[tone];

  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      title={hint}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-800">{label}</div>
        <ChevronRight size={16} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
      </div>
      <div className={"mt-2 text-3xl font-bold tabular-nums " + toneClass}>
        {value.toLocaleString("ko-KR")}
        <span className="ml-1 text-base font-semibold text-slate-500">{unit}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{hint} 보기</p>
    </Link>
  );
}

function UploadHintLink({
  href,
  title,
  hint
}: {
  href: string;
  title: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-okestro-200 hover:bg-okestro-50/40"
    >
      <span className="block text-sm font-semibold text-slate-900">{title}</span>
      <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{hint}</span>
    </Link>
  );
}
