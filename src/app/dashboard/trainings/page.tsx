import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
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
  findLatestTrainingMonth,
  formatAttendanceStatus,
  formatTrainingProduct,
  formatTrainingYearMonth,
  parseYearMonthKey,
  yearMonthKey
} from "@/lib/training-display";
import { formatTrainingTypeLabel } from "@/lib/training/constants";
import { getRealPartnerIdSet, isSamplePartnerName } from "@/lib/partners/sample-filter";
import type { Partner } from "@/types/partner";
import type { Training } from "@/types/training";

type SearchParams = {
  tab?: string;
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

type MonthlySummaryRow = {
  key: string;
  label: string;
  attendanceCount: number;
  partnerCount: number;
};

type AttendeeDetailRow = {
  id: string;
  training_id: string;
  partner_name: string;
  attendee_name: string;
  training_year: number | null;
  training_month: number | null;
  training_name: string;
  training_type: string | null;
  training_level: string | null;
  product: string | null;
  attendee_position: string | null;
  attendee_department: string | null;
  attendee_phone: string | null;
  attendee_email: string | null;
  attended: boolean;
  attendance_status: string | null;
  completion_status: string | null;
  score: number | null;
  evaluation_result: string | null;
  note: string | null;
};

export default async function TrainingsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = parseTrainingTab(params.tab);
  const supabase = await createClient();

  const [
    { error: attendanceCountError },
    { data: trainingsData, error: trainingsError },
    { data: attendanceAggData, error: attendanceAggError },
    { data: attendanceDetailData, error: attendanceDetailError },
    { data: partnersData, error: partnersError }
  ] = await Promise.all([
    supabase.from("training_attendance").select("*", { count: "exact", head: true }),
    supabase
      .from("trainings")
      .select("*")
      .order("training_year", { ascending: false, nullsFirst: false })
      .order("training_month", { ascending: false, nullsFirst: false })
      .order("start_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("training_attendance").select("training_id, partner_id"),
    supabase
      .from("training_attendance")
      .select(
        "id, training_id, attendee_name, attendee_department, attendee_position, attendee_phone, attendee_email, attended, attendance_status, completion_status, score, evaluation_result, note, evaluation_memo, partner:partners(company_name), training:trainings(training_name, training_type, training_level, product, product_name, training_year, training_month)"
      )
      .order("created_at", { ascending: false }),
    supabase.from("partners").select("id, company_name, external_no, memo")
  ]);

  const fetchError =
    attendanceCountError?.message ??
    trainingsError?.message ??
    attendanceAggError?.message ??
    attendanceDetailError?.message ??
    partnersError?.message ??
    null;

  const realPartnerIds = getRealPartnerIdSet((partnersData ?? []) as Partner[]);
  const filteredAttendanceAgg = ((attendanceAggData ?? []) as Array<{
    training_id: string;
    partner_id: string;
  }>).filter((row) => realPartnerIds.has(row.partner_id));

  const trainings = (trainingsData ?? []) as Training[];
  const summaryRows = buildMonthlySummaryRows(trainings, filteredAttendanceAgg);

  const allAttendees = flattenAttendeeRows(attendanceDetailData).filter(
    (row) => !isSamplePartnerName(row.partner_name)
  );
  const monthOptions = buildMonthOptions(trainings);
  const trainingOptions = buildTrainingOptions(trainings, params.month);
  const filteredAttendees = filterAttendees(allAttendees, params);

  const kpi = {
    attendanceCount: allAttendees.length,
    partnerCount: new Set(filteredAttendanceAgg.map((row) => row.partner_id)).size,
    latestMonth: findLatestTrainingMonth(trainings)
  };

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
    교육연월: formatTrainingYearMonth(row.training_year, row.training_month),
    교육구분: formatTrainingTypeLabel(row.training_type),
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
    평가결과: row.evaluation_result ?? "",
    비고: row.note ?? ""
  }));

  const techTrainings = trainings.filter((t) => /기술파트너/.test(t.training_name));

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
          <Link
            href="/dashboard/trainings/tech-partner-upload"
            className="ui-btn-secondary text-sm"
          >
            기술파트너 교육 업로드
          </Link>
        }
      />

      {techTrainings.length > 0 && tab === "summary" ? (
        <section className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <h2 className="text-sm font-bold text-slate-900">기술파트너 교육</h2>
          <div className="mt-3 space-y-2">
            {techTrainings.map((training) => {
              const agg = filteredAttendanceAgg.filter((row) => row.training_id === training.id);
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
                      {training.start_date} ~ {training.end_date} · 참석 {agg.length}건 · 응시{" "}
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
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiBox label="참석 이력 수" value={kpi.attendanceCount} tone="blue" />
          <KpiBox label="교육 참석 파트너 수" value={kpi.partnerCount} tone="violet" />
          <KpiCard label="최근 교육월" value={kpi.latestMonth} tone="emerald" />
        </section>
      ) : null}

      <TrainingTabs active={tab} searchParams={params} />

      {tab === "summary" ? (
        <SummarySection rows={summaryRows} error={trainingsError?.message ?? null} />
      ) : tab === "attendees" ? (
        <AttendeesSection
          rows={filteredAttendees}
          totalCount={allAttendees.length}
          monthOptions={monthOptions}
          trainingOptions={trainingOptions}
          params={params}
          error={attendanceDetailError?.message ?? null}
          csvRows={attendeeExportRows}
        />
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
): "summary" | "attendees" | "recruitment" {
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
  error
}: {
  rows: MonthlySummaryRow[];
  error: string | null;
}) {
  if (error) {
    return (
      <EmptyState title="교육 회차를 불러오지 못했습니다." description={error} />
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="등록된 교육 데이터가 없습니다."
        description="trainings·training_attendance 데이터가 추가되면 월별 요약이 표시됩니다."
      />
    );
  }

  return (
    <>
      <div className="mb-3 text-xs text-slate-500">
        총 <span className="font-semibold text-slate-700">{rows.length}</span>개의 교육연월이
        있습니다.
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[720px] divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>교육연월</Th>
                <Th align="right">참석자 수</Th>
                <Th align="right">참석 파트너 수</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.key} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4 text-sm">
                    <Link
                      href={`/dashboard/trainings?tab=attendees&month=${encodeURIComponent(row.key)}`}
                      className="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                      title={`${row.label} 참석자 보기`}
                    >
                      {row.label}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-900">
                    {row.attendanceCount.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-5 py-4 text-right text-sm tabular-nums text-blue-700">
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
        <TrainingAttendeesTable rows={rows} csvRows={csvRows} />
      )}
    </>
  );
}

function flattenAttendeeRows(data: unknown): AttendeeDetailRow[] {
  if (!Array.isArray(data)) return [];

  return (data as Array<{
    id: string;
    training_id: string;
    attendee_name: string | null;
    attendee_department: string | null;
    attendee_position: string | null;
    attendee_phone: string | null;
    attendee_email: string | null;
    attended: boolean;
    attendance_status: string | null;
    completion_status: string | null;
    score: number | null;
    evaluation_result: string | null;
    note: string | null;
    evaluation_memo: string | null;
    partner: { company_name: string } | Array<{ company_name: string }> | null;
    training:
      | {
          training_name: string;
          training_type: string | null;
          training_level: string | null;
          product: string | null;
          product_name: string | null;
          training_year: number | null;
          training_month: number | null;
        }
      | Array<{
          training_name: string;
          training_type: string | null;
          training_level: string | null;
          product: string | null;
          product_name: string | null;
          training_year: number | null;
          training_month: number | null;
        }>
      | null;
  }>).map((row) => {
    const partner = Array.isArray(row.partner) ? row.partner[0] ?? null : row.partner;
    const training = Array.isArray(row.training) ? row.training[0] ?? null : row.training;

    return {
      id: row.id,
      training_id: row.training_id,
      partner_name: partner?.company_name ?? "-",
      attendee_name: row.attendee_name?.trim() || "-",
      training_year: training?.training_year ?? null,
      training_month: training?.training_month ?? null,
      training_name: training?.training_name ?? "-",
      training_type: training?.training_type ?? null,
      training_level: training?.training_level ?? null,
      product: training?.product ?? training?.product_name ?? null,
      attendee_position: row.attendee_position,
      attendee_department: row.attendee_department,
      attendee_phone: row.attendee_phone,
      attendee_email: row.attendee_email,
      attended: row.attended,
      attendance_status: row.attendance_status,
      completion_status: row.completion_status,
      score: row.score,
      evaluation_result: row.evaluation_result,
      note: row.note ?? row.evaluation_memo
    };
  });
}

function filterAttendees(rows: AttendeeDetailRow[], params: SearchParams): AttendeeDetailRow[] {
  const q = (params.q ?? "").trim().toLowerCase();
  const month = params.month ?? "all";
  const training = params.training ?? "all";

  return rows.filter((row) => {
    if (q) {
      const haystack = [
        row.partner_name,
        row.attendee_name,
        row.training_name,
        row.attendee_email
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    if (month !== "all") {
      const parsed = parseYearMonthKey(month);
      if (
        !parsed ||
        row.training_year !== parsed.year ||
        row.training_month !== parsed.month
      ) {
        return false;
      }

      if (training !== "all" && row.training_id !== training) {
        return false;
      }

      return true;
    }

    if (training !== "all" && row.training_id !== training) {
      return false;
    }

    return true;
  });
}

function buildMonthlySummaryRows(
  trainings: Training[],
  attendanceRows: Array<{ training_id: string; partner_id: string }>
): MonthlySummaryRow[] {
  const trainingById = new Map(trainings.map((training) => [training.id, training]));
  const byMonth = new Map<
    string,
    { trainingIds: Set<string>; attendanceCount: number; partners: Set<string> }
  >();

  for (const training of trainings) {
    if (!training.training_year || !training.training_month) continue;
    const key = yearMonthKey(training.training_year, training.training_month);
    if (!byMonth.has(key)) {
      byMonth.set(key, {
        trainingIds: new Set(),
        attendanceCount: 0,
        partners: new Set()
      });
    }
    byMonth.get(key)!.trainingIds.add(training.id);
  }

  for (const row of attendanceRows) {
    const training = trainingById.get(row.training_id);
    if (!training?.training_year || !training.training_month) continue;
    const key = yearMonthKey(training.training_year, training.training_month);
    const bucket = byMonth.get(key);
    if (!bucket) continue;
    bucket.attendanceCount += 1;
    bucket.partners.add(row.partner_id);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => b.localeCompare(a, "ko-KR", { numeric: true }))
    .map(([key, bucket]) => {
      const parsed = parseYearMonthKey(key)!;
      return {
        key,
        label: formatTrainingYearMonth(parsed.year, parsed.month),
        attendanceCount: bucket.attendanceCount,
        partnerCount: bucket.partners.size
      };
    });
}

function buildMonthOptions(
  trainings: Training[]
): Array<{ value: string; label: string }> {
  const seen = new Map<string, string>();

  for (const training of trainings) {
    if (!training.training_year || !training.training_month) continue;
    const value = yearMonthKey(training.training_year, training.training_month);
    seen.set(
      value,
      formatTrainingYearMonth(training.training_year, training.training_month)
    );
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
    const parsed = parseYearMonthKey(monthFilter);
    if (parsed) {
      scoped = trainings.filter(
        (training) =>
          training.training_year === parsed.year &&
          training.training_month === parsed.month
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
  tone
}: {
  label: string;
  value: number;
  tone: "slate" | "blue" | "emerald" | "violet";
}) {
  const toneClass = {
    slate: "text-slate-900",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    violet: "text-violet-700"
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>
        {value.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "slate" | "blue" | "emerald" | "violet";
}) {
  const toneClass = {
    slate: "text-slate-900",
    blue: "text-blue-700",
    emerald: "text-emerald-700",
    violet: "text-violet-700"
  }[tone];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
