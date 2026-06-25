import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CsvDownloadButton } from "@/components/common/csv-download-button";
import { EventCardGrid } from "@/components/events/event-card-grid";
import { EVENT_TYPE_FILTER_OPTIONS } from "@/lib/events/event-types";
import {
  computeEventSummaryStats,
  fetchPartnerEvents,
  uniqueEventYears
} from "@/lib/data/partner-events";

type SearchParams = {
  q?: string;
  type?: string;
  year?: string;
};

export default async function EventsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const { events, error, documentsError, debug } = await fetchPartnerEvents({
    q: params.q,
    type: params.type,
    year: params.year
  });

  const stats = computeEventSummaryStats(events);
  const yearOptions = uniqueEventYears(events);

  const hasOrphanDocuments =
    !error &&
    debug.fetchedEventsRaw === 0 &&
    debug.fetchedDocuments > 0;

  const exportRows = events.map((event) => ({
    행사명: event.event_name,
    연도: event.year,
    유형: event.event_type,
    일자: event.event_date,
    장소: event.location,
    자료수: event.document_count,
    관련파트너: event.related_partners,
    요약: event.summary,
    폴더: event.source_folder_name
  }));

  return (
    <>
      <PageHeader
        title="행사 현황"
        description="연도별·행사유형별 파트너 행사 자료를 조회합니다."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/events/upload"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
            >
              행사 자료 업로드
            </Link>
            <CsvDownloadButton rows={exportRows} filenamePrefix="partner-events" />
          </div>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiBox label="전체 행사" value={stats.totalEvents} />
        <KpiBox label="올해 행사" value={stats.thisYearEvents} tone="blue" />
        <KpiBox label="파트너데이" value={stats.partnerDayCount} tone="indigo" />
        <KpiBox label="세미나" value={stats.seminarCount} tone="emerald" />
        <KpiBox label="간담회" value={stats.roundtableCount} tone="violet" />
      </section>

      <form className="ui-toolbar mb-5 lg:flex-nowrap">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="행사명, 장소, 관련 파트너, 폴더명 검색"
          className="ui-input min-w-[220px] flex-1"
        />
        <select name="type" defaultValue={params.type ?? "all"} className="ui-select w-44 shrink-0">
          <option value="all">전체 유형</option>
          {EVENT_TYPE_FILTER_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select name="year" defaultValue={params.year ?? "all"} className="ui-select w-32 shrink-0">
          <option value="all">전체 연도</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button type="submit" className="ui-btn-accent shrink-0">
          검색
        </button>
      </form>

      <div className="mb-4 text-xs text-slate-500">
        총 <span className="font-semibold text-slate-700">{events.length}</span>건의 행사가
        검색되었습니다.
      </div>

      {error ? (
        <EmptyState
          title="행사 조회 중 오류가 발생했습니다."
          description={error}
        />
      ) : hasOrphanDocuments ? (
        <EmptyState
          title="행사 자료는 있으나 행사 마스터 조회를 확인해야 합니다."
          description={`partner_event_documents ${debug.fetchedDocuments}건이 조회되었으나 partner_events는 0건입니다. RLS 정책 또는 인증 상태를 확인해 주세요.${
            documentsError ? ` (자료 조회 오류: ${documentsError})` : ""
          }`}
        />
      ) : events.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            title="등록된 행사가 없습니다."
            description={
              debug.fetchedEventsRaw > 0
                ? `DB에 행사 ${debug.fetchedEventsRaw}건이 조회되었으나 필터 조건에 맞는 행사가 없습니다.`
                : "행사 자료 업로드에서 폴더를 선택해 저장하면 이 화면에 행사가 표시됩니다."
            }
          />
          <div className="text-center">
            <Link href="/dashboard/events/upload" className="ui-btn-accent inline-flex">
              행사 자료 업로드
            </Link>
          </div>
        </div>
      ) : (
        <>
          {documentsError ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              행사 자료 집계 조회 오류: {documentsError} (행사 목록은 표시되며 자료 수는 0으로
              보일 수 있습니다.)
            </div>
          ) : null}
          <EventCardGrid events={events} />
        </>
      )}

      <EventsFetchDebugPanel debug={debug} documentsError={documentsError} />
    </>
  );
}

function EventsFetchDebugPanel({
  debug,
  documentsError
}: {
  debug: {
    fetchedEventsRaw: number;
    fetchedEventsDisplay: number;
    fetchedDocuments: number;
    eventsError: string | null;
    documentsError: string | null;
  };
  documentsError: string | null;
}) {
  return (
    <details className="mt-8 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-500">
      <summary className="cursor-pointer font-medium text-slate-600">조회 디버그</summary>
      <dl className="mt-2 grid gap-1 sm:grid-cols-2">
        <div>
          <dt className="inline">fetchedEventsRaw: </dt>
          <dd className="inline font-mono text-slate-700">{debug.fetchedEventsRaw}</dd>
        </div>
        <div>
          <dt className="inline">fetchedEventsDisplay: </dt>
          <dd className="inline font-mono text-slate-700">{debug.fetchedEventsDisplay}</dd>
        </div>
        <div>
          <dt className="inline">fetchedDocuments: </dt>
          <dd className="inline font-mono text-slate-700">{debug.fetchedDocuments}</dd>
        </div>
        <div>
          <dt className="inline">eventsError: </dt>
          <dd className="inline font-mono text-slate-700">{debug.eventsError ?? "null"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="inline">documentsError: </dt>
          <dd className="inline font-mono text-slate-700">
            {documentsError ?? debug.documentsError ?? "null"}
          </dd>
        </div>
      </dl>
    </details>
  );
}

function KpiBox({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: number;
  tone?: "slate" | "blue" | "indigo" | "emerald" | "violet";
}) {
  const toneClass = {
    slate: "text-slate-900",
    blue: "text-okestro-700",
    indigo: "text-indigo-700",
    emerald: "text-emerald-700",
    violet: "text-violet-700"
  }[tone];

  return (
    <div className="ui-kpi">
      <div className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-bold tabular-nums tracking-tight ${toneClass}`}>
        {value.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}
