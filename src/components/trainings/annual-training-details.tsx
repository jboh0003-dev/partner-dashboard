import Link from "next/link";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { TrainingAttendeesTable } from "@/components/trainings/training-attendees-table";
import { normalizeAttendeePersonKey } from "@/lib/trainings/attendance-stats";
import type { AnnualTrainingKpis } from "@/lib/trainings/annual-attendance-summary";
import { formatTrainingGroupLabel, isTechPartnerTraining } from "@/lib/training-display";

export type AnnualKpiView = "unique" | "all" | "partners";

export function isAnnualKpiView(value?: string): value is AnnualKpiView {
  return value === "unique" || value === "all" || value === "partners";
}

function detailHref(
  view: AnnualKpiView,
  options: { partnerId?: string; personKey?: string; q?: string } = {}
) {
  const params = new URLSearchParams({
    tab: "attendees",
    year: "2026",
    view
  });
  if (options.partnerId) params.set("partner", options.partnerId);
  if (options.personKey) params.set("person", options.personKey);
  if (options.q) params.set("q", options.q);
  return "/dashboard/trainings?" + params.toString();
}

const viewLabels: Record<AnnualKpiView, string> = {
  unique: "2026 참석자(중복제외)",
  all: "2026 참석자(중복포함)",
  partners: "2026 참석파트너"
};

export function AnnualTrainingDetails({
  data,
  view,
  partnerId,
  personKey,
  q,
  error
}: {
  data: AnnualTrainingKpis;
  view: AnnualKpiView;
  partnerId?: string;
  personKey?: string;
  q?: string;
  error?: string | null;
}) {
  const search = (q ?? "").trim().toLocaleLowerCase("ko-KR");
  const partner = partnerId ? data.partners.find((item) => item.id === partnerId) : null;
  const people = data.people.filter((person) =>
    (!partnerId || person.partnerId === partnerId) &&
    (!personKey || person.key === personKey) &&
    (!search || [
      person.partnerName, person.name, person.position, person.department,
      ...person.trainingNames
    ].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR").includes(search))
  );
  const partners = data.partners.filter((item) =>
    (!partnerId || item.id === partnerId) &&
    (!search || item.name.toLocaleLowerCase("ko-KR").includes(search))
  );
  const attendanceRows = data.attendanceRows.filter((row) =>
    (!partnerId || row.partner_id === partnerId) &&
    (!personKey || row.partner_id + "|" + normalizeAttendeePersonKey(row.attendee_name) === personKey) &&
    (!search || [
      row.partner_name, row.attendee_name, row.training_name,
      row.attendee_department, row.attendee_position, row.attendee_email
    ].filter(Boolean).join(" ").toLocaleLowerCase("ko-KR").includes(search))
  );
  const visibleCount = view === "unique" ? people.length
    : view === "partners" ? partners.length : attendanceRows.length;

  const csvRows = attendanceRows.map((row) => ({
    파트너사: row.partner_name,
    이름: row.attendee_name,
    교육연월: formatTrainingGroupLabel(
      row.training_year, row.training_month, isTechPartnerTraining(row)
    ),
    교육명: row.training_name,
    직급: row.attendee_position ?? "",
    직무: row.attendee_department ?? "",
    참석상태: row.attendance_status ?? "참석"
  }));

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">{viewLabels[view]} 상세</h2>
            <p className="mt-1 text-xs text-slate-500">
              2026년 실제 참석 기록 기준 · 비파트너, 불참, 삭제 기록 제외
            </p>
          </div>
          <Link
            href="/dashboard/trainings?tab=summary"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft size={13} /> 월별 교육 요약
          </Link>
        </div>
        <nav aria-label="2026 교육 집계 상세 선택" className="mt-4 flex flex-wrap gap-2">
          {([
            ["unique", data.uniqueAttendees, "명"],
            ["all", data.totalAttendances, "건"],
            ["partners", data.partnerCount, "개사"]
          ] as const).map(([key, count, unit]) => (
            <Link
              key={key}
              href={detailHref(key)}
              aria-current={view === key ? "page" : undefined}
              className={[
                "rounded-xl px-3 py-2 text-xs font-semibold transition",
                view === key
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              ].join(" ")}
            >
              {viewLabels[key]} {count.toLocaleString("ko-KR")}{unit}
            </Link>
          ))}
        </nav>

        {partner ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-800">{partner.name}</span>
            <span className="text-xs text-slate-500">
              참석자 {partner.uniquePeople}명 · 참석기록 {partner.attendanceCount}건
            </span>
            <Link className="text-xs font-semibold text-blue-700 hover:underline" href={detailHref(view)}>
              전체 보기
            </Link>
          </div>
        ) : null}
        {personKey ? (
          <div className="mt-2 text-xs text-slate-500">
            선택한 참석자의 교육별 상세만 표시합니다.
            <Link className="ml-2 font-semibold text-blue-700 hover:underline"
              href={detailHref("all", { partnerId })}>
              개인 선택 해제
            </Link>
          </div>
        ) : null}

        <form className="mt-4 flex flex-wrap items-center gap-2" method="get">
          <input type="hidden" name="tab" value="attendees" />
          <input type="hidden" name="year" value="2026" />
          <input type="hidden" name="view" value={view} />
          {partnerId ? <input type="hidden" name="partner" value={partnerId} /> : null}
          {personKey ? <input type="hidden" name="person" value={personKey} /> : null}
          <input
            key={view + "|" + (partnerId ?? "") + "|" + (q ?? "")}
            name="q"
            defaultValue={q ?? ""}
            placeholder="파트너사, 이름, 교육명 검색"
            className="min-w-[230px] flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600"
          />
          <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
            <Search size={15} /> 검색
          </button>
        </form>
      </div>

      {error ? <EmptyState title="참석 내역을 불러오지 못했습니다." description={error} /> : (
        <>
          <p className="px-1 text-sm text-slate-600">
            {viewLabels[view]} · <span className="font-bold tabular-nums text-slate-900">{visibleCount.toLocaleString("ko-KR")}</span>
            {view === "all" ? "건" : view === "partners" ? "개사" : "명"}
          </p>
          {visibleCount === 0 ? (
            <EmptyState title="해당하는 참석 기록이 없습니다." description="검색 조건을 변경해 주세요." />
          ) : view === "all" ? (
            <TrainingAttendeesTable rows={attendanceRows} csvRows={csvRows} csvLabel="CSV 다운로드" />
          ) : view === "unique" ? (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[940px] divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3">파트너사</th>
                    <th className="whitespace-nowrap px-5 py-3">이름</th>
                    <th className="whitespace-nowrap px-5 py-3">직급 / 부서</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">참석 기록</th>
                    <th className="whitespace-nowrap px-5 py-3">참석 월</th>
                    <th className="whitespace-nowrap px-5 py-3">교육과정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {people.map((person) => (
                    <tr key={person.key} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-700">
                        {person.partnerName}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <Link
                          className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
                          href={detailHref("all", { partnerId: person.partnerId, personKey: person.key })}
                          title="이 참석자의 교육별 기록 보기"
                        >
                          {person.name} <ChevronRight size={13} />
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {[person.position, person.department].filter(Boolean).join(" / ") || "-"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-slate-800">
                        {person.attendanceCount}건
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {person.trainingMonths.map((m) => m + "월").join(", ") || "-"}
                      </td>
                      <td className="max-w-[340px] truncate whitespace-nowrap px-5 py-3 text-slate-600"
                        title={person.trainingNames.join(", ")}>
                        {person.trainingNames.join(", ") || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[660px] divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-5 py-3">파트너사</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">중복제외 참석자</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">중복포함 참석 기록</th>
                    <th className="whitespace-nowrap px-5 py-3 text-right">상세</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partners.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-3">
                        <Link
                          href={detailHref("unique", { partnerId: item.id })}
                          className="font-semibold text-blue-700 hover:underline"
                          title="해당 파트너의 실제 참석자 보기"
                        >
                          {item.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-800">
                        {item.uniquePeople}명
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums text-slate-800">
                        {item.attendanceCount}건
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        <Link href={detailHref("all", { partnerId: item.id })}
                          className="font-semibold text-blue-700 hover:underline">
                          교육별 보기
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
