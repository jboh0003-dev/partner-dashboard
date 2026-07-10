"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { TableCopyToolbar } from "@/components/common/table-copy-toolbar";
import { useTableSelection } from "@/hooks/use-table-selection";
import {
  RECRUITMENT_SELECTED_ROW_TSV,
  recruitmentRowToCopyable
} from "@/lib/clipboard/row-mappers";
import { COURSE_TAGS } from "@/lib/trainings/course-tags";
import {
  parseMonthsParam,
  recruitmentRowsToCsv,
  type RecruitmentRow
} from "@/lib/trainings/recruitment";

type TrainingRecruitmentPanelProps = {
  rows: RecruitmentRow[];
  monthOptions: Array<{ value: string; label: string }>;
  params: Record<string, string | string[] | undefined>;
  error?: string | null;
};

export function TrainingRecruitmentPanel({
  rows,
  monthOptions,
  params,
  error
}: TrainingRecruitmentPanelProps) {
  const selectedMonths = parseMonthsParam(params.months);
  const selectedAttendedTags = parseTagsParam(params.attended_tags);
  const selectedNotAttendedTags = parseTagsParam(params.not_attended_tags);

  const selection = useTableSelection(rows, (row) => row.id);
  const copyableRows = useMemo(() => rows.map(recruitmentRowToCopyable), [rows]);
  const csvRows = useMemo(() => recruitmentRowsToCsv(rows), [rows]);

  const audience = typeof params.audience === "string" ? params.audience : "no_history";

  return (
    <>
      <form className="mb-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="tab" value="recruitment" />

        <input
          name="q"
          defaultValue={getStringParam(params.q)}
          placeholder="회사명, 담당자명, 연락처, 이메일 검색"
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-blue-600"
        />

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            대상 유형
            <select
              name="audience"
              defaultValue={audience}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
            >
              <option value="all">전체 파트너 (활성)</option>
              <option value="no_history">교육 이력 없는 파트너</option>
              <option value="month_absent">선택 교육연월 미참석 파트너</option>
              <option value="prior_history_month_absent">
                이전 교육 이력 있으나 선택 교육연월 미참석
              </option>
              <option value="course_tags">특정 교육 수강 / 미수강 조건</option>
              <option value="new_no_history">신규 파트너 중 교육 미참석</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            등급
            <select
              name="grade"
              defaultValue={getStringParam(params.grade) || "all"}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
            >
              <option value="all">전체 등급</option>
              <option value="platinum">Platinum</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="strategic">Strategic</option>
              <option value="none">미분류</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            담당자 유형
            <select
              name="contact_role"
              defaultValue={getStringParam(params.contact_role) || "all"}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
            >
              <option value="all">전체 (우선순위 자동)</option>
              <option value="contract">계약담당자</option>
              <option value="primary">주담당자</option>
              <option value="sales">영업</option>
              <option value="engineer">엔지니어</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            신규 파트너 기준일
            <input
              type="date"
              name="new_partner_since"
              defaultValue={getStringParam(params.new_partner_since)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
            />
            <span className="text-[11px] font-normal text-slate-400">
              신규 파트너 조건에서 사용 (예: 2026-01-01 이후 계약)
            </span>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            계약일자 (시작)
            <input
              type="date"
              name="contract_from"
              defaultValue={getStringParam(params.contract_from)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-600">
            계약일자 (종료)
            <input
              type="date"
              name="contract_to"
              defaultValue={getStringParam(params.contract_to)}
              className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-800"
            />
          </label>
        </div>

        <fieldset className="rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-xs font-semibold text-slate-600">
            교육연월 (복수 선택)
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {monthOptions.map((option) => (
              <label
                key={option.value}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  name="months"
                  value={option.value}
                  defaultChecked={selectedMonths.includes(option.value)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                {option.label}
              </label>
            ))}
            {monthOptions.length === 0 ? (
              <span className="text-sm text-slate-400">등록된 교육연월이 없습니다.</span>
            ) : null}
          </div>
        </fieldset>

        <div className="grid gap-3 lg:grid-cols-2">
          <fieldset className="rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">
              수강한 교육 태그
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COURSE_TAGS.filter((tag) => tag !== "기타").map((tag) => (
                <label
                  key={tag}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="attended_tags"
                    value={tag}
                    defaultChecked={selectedAttendedTags.includes(tag)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {tag}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">
              미수강 교육 태그
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COURSE_TAGS.filter((tag) => tag !== "기타").map((tag) => (
                <label
                  key={tag}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name="not_attended_tags"
                    value={tag}
                    defaultChecked={selectedNotAttendedTags.includes(tag)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {tag}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <button
            type="submit"
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            조회
          </button>
        </div>
      </form>

      <TableCopyToolbar
        allRows={copyableRows}
        selectedIds={selection.selectedIds}
        selectedCount={selection.selectedCount}
        totalCount={rows.length}
        onClearSelection={selection.clearSelection}
        selectedRowTsv={RECRUITMENT_SELECTED_ROW_TSV}
        csvRows={csvRows}
        csvFilenamePrefix="training-recruitment"
      />

      {error ? (
        <EmptyState title="모객 대상을 불러오지 못했습니다." description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="조건에 맞는 모객 대상이 없습니다."
          description="대상 유형·교육연월·교육 태그·담당자 유형 필터를 조정해 보세요."
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1500px] divide-y divide-slate-200 select-none">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selection.allSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = selection.someSelected;
                      }}
                      onChange={selection.toggleAll}
                      aria-label="현재 필터 결과 전체 선택"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <Th>회사명</Th>
                  <Th>등급</Th>
                  <Th>계약일자</Th>
                  <Th>최근 교육월</Th>
                  <Th align="right">교육 참석 이력 수</Th>
                  <Th>수강 교육 태그</Th>
                  <Th>미수강 교육 태그</Th>
                  <Th>담당자명</Th>
                  <Th>직급</Th>
                  <Th>역할</Th>
                  <Th>연락처</Th>
                  <Th>이메일</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                    <tr key={row.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={selection.selectedIds.has(row.id)}
                          onChange={() => selection.toggleRow(row.id)}
                          aria-label={`${row.companyName} 선택`}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-5 py-4 align-top text-sm">
                        <Link
                          href={`/dashboard/partners/${row.partnerId}`}
                          title="상세 보기"
                          className="font-semibold text-blue-700 transition hover:text-blue-900 hover:underline"
                        >
                          {row.companyName}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">{row.gradeLabel}</td>
                      <td className="px-5 py-4 text-sm tabular-nums text-slate-700">
                        {row.contractStartDateLabel}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.latestTrainingMonth ?? "-"}
                      </td>
                      <td className="px-5 py-4 text-right text-sm tabular-nums text-slate-900">
                        {row.attendanceCount.toLocaleString("ko-KR")}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.attendedCourseTags}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.notAttendedCourseTags}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.contactName ?? "-"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.contactPosition ?? "-"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {row.contactRoleLabel}
                      </td>
                      <td className="px-5 py-4 text-sm tabular-nums text-slate-700">
                        {row.contactPhone ?? "-"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-700">
                        <span className="block max-w-[240px] truncate">
                          {row.contactEmail ?? "-"}
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

function getStringParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseTagsParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function Th({
  children,
  align = "left"
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={[
        "px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500",
        align === "right" ? "text-right" : "text-left"
      ].join(" ")}
    >
      {children}
    </th>
  );
}
