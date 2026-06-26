"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  FlaskConical,
  GraduationCap,
  Info,
  MonitorUp,
  StickyNote,
  TrendingUp
} from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { ContactTagsBadges } from "@/components/contacts/contact-tags-badges";
import { mergePartnerOrganizationContacts } from "@/lib/contacts/organization-merge";
import { DOCUMENT_TYPE_LABEL, POC_RESULT_STATUS_LABEL } from "@/lib/constants";
import { PartnerDocumentsTab } from "@/components/partners/partner-documents-tab";
import { PartnerPerformanceTab } from "@/components/partners/partner-performance-tab";
import { formatAssetUpdatedAt } from "@/lib/assets/display";
import { formatAssetNodeDisplayName } from "@/lib/assets/partner-detail-assets";
import { pickPartnerAssetStatus } from "@/lib/assets/node-utils";
import { AssetNodeCard } from "@/components/assets/asset-node-card";
import { formatPartnerNo } from "@/lib/partners/partner-no";
import { formatDate } from "@/lib/utils";
import type {
  PartnerDetailBundle,
  PartnerEventHistoryItem,
  PartnerTrainingHistoryItem,
  PartnerTrainingSessionGroup
} from "@/types/partner-detail";
import type { PartnerTrainingMonthly } from "@/types/partner";
import type { PartnerAsset } from "@/types/asset";
import type { PartnerDocument } from "@/types/document";
import type { PartnerPoc } from "@/types/poc";

type TabKey =
  | "basic"
  | "organization"
  | "trainings"
  | "events"
  | "pocs"
  | "assets"
  | "documents"
  | "performance"
  | "notes";

type PartnerDetailTabsProps = {
  bundle: PartnerDetailBundle;
  addNoteAction: (formData: FormData) => Promise<void>;
  initialTab?: string;
};

const TAB_KEYS: TabKey[] = [
  "basic",
  "organization",
  "trainings",
  "events",
  "pocs",
  "assets",
  "documents",
  "performance",
  "notes"
];

const TABS: Array<{ key: TabKey; label: string; icon: typeof Info }> = [
  { key: "basic", label: "기본정보", icon: Info },
  { key: "organization", label: "조직현황", icon: Building2 },
  { key: "trainings", label: "교육 이력", icon: GraduationCap },
  { key: "events", label: "행사 이력", icon: CalendarDays },
  { key: "pocs", label: "PoC 이력", icon: FlaskConical },
  { key: "assets", label: "장비/리소스", icon: MonitorUp },
  { key: "documents", label: "문서", icon: FileText },
  { key: "performance", label: "실적/파이프라인", icon: TrendingUp },
  { key: "notes", label: "메모/히스토리", icon: StickyNote }
];

export function PartnerDetailTabs({
  bundle,
  addNoteAction,
  initialTab
}: PartnerDetailTabsProps) {
  const {
    partner,
    contacts,
    notes,
    trainings,
    trainingSessions,
    monthlyTrainings,
    events,
    pocs,
    assets,
    documents,
    performance
  } = bundle;
  const [active, setActive] = useState<TabKey>(() => parseInitialTab(initialTab));

  useEffect(() => {
    setActive(parseInitialTab(initialTab));
  }, [initialTab]);

  const organizationMerge = useMemo(
    () => mergePartnerOrganizationContacts(contacts),
    [contacts]
  );

  const counts: Record<TabKey, number> = {
    basic: 0,
    organization: organizationMerge.merged.length,
    trainings: trainings.length + monthlyTrainings.length,
    events: events.length,
    pocs: pocs.length,
    assets: assets.length,
    documents: documents.length,
    performance:
      performance.win_forecast_count + performance.new_reg_count + performance.revenue_count,
    notes: notes.length
  };

  return (
    <section className="ui-card overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-slate-100 bg-slate-50/50 px-3 pt-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          const count = counts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={isActive ? "ui-tab-active -mb-px" : "ui-tab"}
            >
              <Icon size={16} className={isActive ? "text-okestro-600" : "text-slate-400"} />
              {tab.label}
              {count > 0 ? (
                <span
                  className={[
                    "ml-1 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-2xs font-semibold",
                    isActive ? "bg-okestro-100 text-okestro-700" : "bg-slate-100 text-slate-500"
                  ].join(" ")}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="p-6">
        {active === "basic" ? <BasicInfoTab partner={partner} /> : null}
        {active === "organization" ? <OrganizationTab contacts={contacts} /> : null}
        {active === "trainings" ? (
          <TrainingsTab
            sessions={trainingSessions}
            trainings={trainings}
            monthly={monthlyTrainings}
          />
        ) : null}
        {active === "events" ? <EventsTab events={events} /> : null}
        {active === "pocs" ? <PocsTab pocs={pocs} /> : null}
        {active === "assets" ? <AssetsTab assets={assets} /> : null}
        {active === "documents" ? (
          <PartnerDocumentsTab documents={documents} />
        ) : null}
        {active === "performance" ? <PartnerPerformanceTab performance={performance} /> : null}
        {active === "notes" ? (
          <NotesTab
            partnerId={partner.id}
            notes={notes}
            addNoteAction={addNoteAction}
          />
        ) : null}
      </div>
    </section>
  );
}

function BasicInfoTab({ partner }: { partner: PartnerDetailBundle["partner"] }) {
  const rows: Array<[string, string]> = [
    ["파트너번호", formatPartnerNo(partner)],
    ["파트너사명", partner.company_name],
    ["사업자번호", partner.business_number ?? "-"],
    ["대표이사", partner.ceo_name ?? "-"],
    ["대표전화", partner.main_phone ?? "-"],
    ["주소", partner.address ?? "-"],
    ["웹사이트", partner.website ?? "-"],
    ["계약 시작일", partner.contract_start_date ?? "-"],
    ["계약 종료일", partner.contract_end_date ?? "-"],
    ["메모", partner.memo ?? "-"]
  ];

  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </dt>
          <dd className="mt-1.5 break-words text-sm text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function OrganizationTab({ contacts }: { contacts: PartnerDetailBundle["contacts"] }) {
  const { merged, raw_count } = useMemo(
    () => mergePartnerOrganizationContacts(contacts),
    [contacts]
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (contacts.length === 0) {
    return (
      <EmptyState
        title="등록된 담당자가 없습니다."
        description="파트너사의 영업·엔지니어·계약담당자·교육 참석자 정보를 등록하면 이 탭에 표시됩니다."
      />
    );
  }

  const hasContractContact = merged.some((contact) => contact.is_contract_contact);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {!hasContractContact ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
          계약담당자가 아직 지정되지 않았습니다. 영업 시 연락할 담당자를 확인해 주세요.
        </div>
      ) : null}
      <p className="text-xs text-slate-500">
        원본 {raw_count}건 · 병합 표시 {merged.length}명
      </p>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-8 px-2 py-2.5" aria-label="상세" />
              <Th align="left">담당구분</Th>
              <Th>이름</Th>
              <Th>부서/직급</Th>
              <Th>연락처</Th>
              <Th>이메일</Th>
              <Th>출처/태그</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {merged.map((contact) => {
              const expanded = expandedIds.has(contact.id);
              const hasDetails =
                contact.alternate_phones.length > 0 ||
                contact.alternate_emails.length > 0 ||
                contact.sources.length > 0 ||
                contact.phone_email_swapped;

              return (
                <Fragment key={contact.id}>
                  <tr key={contact.id} className="hover:bg-slate-50">
                    <td className="px-2 py-2.5">
                      {hasDetails ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(contact.id)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          aria-label={expanded ? "상세 접기" : "상세 펼치기"}
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-sm">
                      <div className="flex flex-wrap items-center gap-1">
                        <ContactTagsBadges tags={contact.tags} />
                        {contact.has_multiple_sources ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                            복수 출처
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900">{contact.name}</td>
                    <td className="px-4 py-2.5 text-sm">
                      {[contact.department, contact.position].filter(Boolean).join(" / ") ||
                        "-"}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">{contact.phone ?? "-"}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">{contact.email ?? "-"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {contact.sources.length > 0 ? contact.sources.join(", ") : "-"}
                    </td>
                  </tr>
                  {expanded && hasDetails ? (
                    <tr key={`${contact.id}-detail`} className="bg-slate-50/80">
                      <td colSpan={7} className="px-4 py-3 text-xs text-slate-600">
                        <div className="space-y-1">
                          {contact.phone_email_swapped ? (
                            <p className="text-amber-700">연락처/이메일 뒤바뀜 후보 — 화면 표시에서 보정됨</p>
                          ) : null}
                          {contact.alternate_phones.length > 0 ? (
                            <p>보조 연락처: {contact.alternate_phones.join(", ")}</p>
                          ) : null}
                          {contact.alternate_emails.length > 0 ? (
                            <p>보조 이메일: {contact.alternate_emails.join(", ")}</p>
                          ) : null}
                          {contact.sources.length > 0 ? (
                            <p>데이터 출처: {contact.sources.join(", ")}</p>
                          ) : null}
                          {contact.member_ids.length > 1 ? (
                            <p>병합된 원본 row: {contact.member_ids.length}건</p>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 교육 이력 탭
 */
function TrainingsTab({
  sessions,
  trainings,
  monthly
}: {
  sessions: PartnerTrainingSessionGroup[];
  trainings: PartnerTrainingHistoryItem[];
  monthly: PartnerTrainingMonthly[];
}) {
  if (sessions.length === 0 && trainings.length === 0 && monthly.length === 0) {
    return (
      <EmptyState
        title="등록된 교육 이력이 없습니다."
        description="training_attendance 또는 partner_training_monthly에 데이터가 채워지면 자동으로 표시됩니다."
      />
    );
  }

  const techSessions = sessions.filter((s) => s.is_tech_partner);
  const legacyTrainings = trainings.filter(
    (t) => !techSessions.some((s) => s.training_id === t.training_id)
  );

  return (
    <div className="space-y-6">
      {techSessions.map((session) => (
        <div key={session.training_id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{session.training_name}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {session.training_type ?? "기술파트너 교육"} · {formatPeriod(session.start_date, session.end_date)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-2 py-1">참석 {session.attendee_count}명</span>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                응시 {session.exam_taken_count}명
              </span>
              {session.avg_total_score != null ? (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                  평균 총점 {session.avg_total_score}
                </span>
              ) : null}
              {session.avg_converted_score != null ? (
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                  평균 환산 {session.avg_converted_score}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-left">직급</th>
                  <th className="px-3 py-2 text-right">출석</th>
                  <th className="px-3 py-2 text-right">결석</th>
                  <th className="px-3 py-2 text-right">부분</th>
                  <th className="px-3 py-2 text-center">응시</th>
                  <th className="px-3 py-2 text-right">순위</th>
                  <th className="px-3 py-2 text-right">총점</th>
                  <th className="px-3 py-2 text-right">환산</th>
                  <th className="px-3 py-2 text-right">솔루션</th>
                  <th className="px-3 py-2 text-right">심화</th>
                  <th className="px-3 py-2 text-right">운영</th>
                  <th className="px-3 py-2 text-right">TS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {session.participants.map((p) => {
                  const extra = p.extra_json ?? {};
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2 font-medium">
                        <div>{p.attendee_name ?? "-"}</div>
                        {typeof extra.attendance_scope === "string" ? (
                          <div className="text-[11px] font-normal text-slate-500">
                            참석 {extra.attendance_scope}
                          </div>
                        ) : null}
                        {typeof extra.manual_correction_note === "string" ? (
                          <div className="text-[11px] font-normal text-amber-700">
                            {extra.manual_correction_note}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{p.attendee_position ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{p.attendance_days ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{p.absent_days ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{p.partial_days ?? "-"}</td>
                      <td className="px-3 py-2 text-center">{p.exam_status ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{p.rank ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{p.score ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{p.converted_score ?? "-"}</td>
                      <td className="px-3 py-2 text-right">
                        {formatExtraScore(extra, "solution_understanding_score")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatExtraScore(extra, "advanced_basic_score")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatExtraScore(extra, "operation_score")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatExtraScore(extra, "troubleshooting_score")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {legacyTrainings.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-900">
            정기교육 참석 ({legacyTrainings.length})
          </h3>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>교육명</Th>
                  <Th>유형/제품</Th>
                  <Th>기간</Th>
                  <Th>참석자</Th>
                  <Th align="center">참석</Th>
                  <Th align="center">결과</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {legacyTrainings.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                      {t.training_name}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">
                      {[t.training_type, t.product_name].filter(Boolean).join(" · ") || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-slate-700">
                      {formatPeriod(t.start_date, t.end_date)}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">
                      {[t.attendee_name, t.attendee_department, t.attendee_position]
                        .filter(Boolean)
                        .join(" · ") || "-"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <BoolMark v={t.attended} />
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs">
                      {t.evaluation_result ? (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                          {t.evaluation_result}
                          {t.score != null ? (
                            <span className="ml-1 text-blue-500">{t.score}</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {monthly.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-900">
            월별 교육 출석 ({monthly.length})
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            엑셀 업로드에서 추출한 월별 출석 여부입니다.
          </p>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>월</Th>
                  <Th align="center">참석</Th>
                  <Th>원본값</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...monthly]
                  .sort((a, b) => {
                    if (a.training_year !== b.training_year) {
                      return b.training_year - a.training_year;
                    }
                    return b.training_month - a.training_month;
                  })
                  .map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                        {m.training_year}년 {m.training_month}월
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <AttendMark attended={m.attended} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {m.raw_value?.trim() ? m.raw_value : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EventsTab({ events }: { events: PartnerEventHistoryItem[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="등록된 행사 이력이 없습니다."
        description="행사 상세 화면에서 관련 파트너를 연결하면 이 탭에 표시됩니다."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <Th>행사명</Th>
            <Th>일자</Th>
            <Th>유형</Th>
            <Th>관계유형</Th>
            <Th>자료 수</Th>
            <Th align="right">상세</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {events.map((e) => (
            <tr key={`${e.source}-${e.id}`} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                {e.event_name}
              </td>
              <td className="px-4 py-2.5 text-sm tabular-nums text-slate-700">
                {e.event_date ? formatDate(e.event_date) : "-"}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-700">
                {e.event_type ?? "-"}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-700">
                {e.relation_type ?? "-"}
              </td>
              <td className="px-4 py-2.5 text-sm tabular-nums text-slate-700">
                {e.document_count ?? 0}건
              </td>
              <td className="px-4 py-2.5 text-right">
                <Link
                  href={`/dashboard/events/${e.event_id}`}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  상세 보기
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PocsTab({ pocs }: { pocs: PartnerPoc[] }) {
  if (pocs.length === 0) {
    return (
      <EmptyState
        title="등록된 PoC 이력이 없습니다."
        description="partner_pocs 테이블에 PoC 프로젝트 이력을 등록하면 여기에 표시됩니다."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <Th>PoC명</Th>
            <Th>고객사</Th>
            <Th>제품</Th>
            <Th>기간</Th>
            <Th>역할</Th>
            <Th>결과</Th>
            <Th>요약</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pocs.map((p) => (
            <tr key={p.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
                {p.poc_name ?? "-"}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-700">{p.customer_name ?? "-"}</td>
              <td className="px-4 py-2.5 text-sm text-slate-700">{p.product_name ?? "-"}</td>
              <td className="px-4 py-2.5 text-sm tabular-nums text-slate-700">
                {formatPeriod(p.start_date, p.end_date)}
              </td>
              <td className="px-4 py-2.5 text-sm text-slate-700">
                {p.role_description ?? "-"}
              </td>
              <td className="px-4 py-2.5 text-sm">
                {p.result_status ? (
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {POC_RESULT_STATUS_LABEL[p.result_status] ?? p.result_status}
                  </span>
                ) : (
                  "-"
                )}
              </td>
              <td className="max-w-[280px] px-4 py-2.5 text-sm text-slate-600">
                {p.result_summary ?? p.memo ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetsTab({ assets }: { assets: PartnerAsset[] }) {
  if (assets.length === 0) {
    return (
      <EmptyState
        title="등록된 장비 정보가 없습니다."
        description="장비현황 파일을 업로드하면 이 파트너의 보유 장비·리소스가 표시됩니다."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        장비상태:{" "}
        <span className="font-semibold text-slate-900">
          {pickPartnerAssetStatus(assets) ?? "-"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {assets.map((asset) => (
          <AssetNodeCard
            key={asset.id}
            asset={asset}
            displayNodeName={formatAssetNodeDisplayName(asset)}
          />
        ))}
      </div>

      <div className="text-xs text-slate-400">
        최종 업데이트: {formatAssetUpdatedAt(assets[0])}
      </div>
    </div>
  );
}

function parseInitialTab(value: string | undefined): TabKey {
  if (value && TAB_KEYS.includes(value as TabKey)) {
    return value as TabKey;
  }
  return "basic";
}

function NotesTab({
  partnerId,
  notes,
  addNoteAction
}: {
  partnerId: string;
  notes: PartnerDetailBundle["notes"];
  addNoteAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <form
        action={addNoteAction}
        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        <input type="hidden" name="partner_id" value={partnerId} />
        <label className="text-xs font-semibold text-slate-500">제목</label>
        <input
          name="title"
          placeholder="예: 6월 정기 미팅"
          className="mb-3 mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
        />
        <label className="text-xs font-semibold text-slate-500">내용</label>
        <textarea
          name="content"
          placeholder="미팅 내용, 이슈, 후속조치 등을 입력"
          required
          rows={6}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
        />
        <div className="mt-3 flex justify-end">
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            메모 추가
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {notes.length === 0 ? (
          <EmptyState
            title="등록된 메모가 없습니다."
            description="왼쪽 폼에서 첫 메모를 작성해 보세요."
          />
        ) : (
          notes.map((note) => (
            <article
              key={note.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">
                  {note.title ?? "메모"}
                </div>
                <div className="text-xs text-slate-400">
                  {formatDate(note.created_at)}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {note.content}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
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
        "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500",
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

function BoolMark({ v }: { v: boolean }) {
  if (!v) return <span className="text-xs text-slate-300">·</span>;
  return (
    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-bold text-blue-700">
      O
    </span>
  );
}

function AttendMark({ attended }: { attended: boolean }) {
  return attended ? (
    <span className="inline-flex min-w-[28px] items-center justify-center rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
      O
    </span>
  ) : (
    <span className="inline-flex min-w-[28px] items-center justify-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
      X
    </span>
  );
}

function formatExtraScore(extra: Record<string, unknown>, key: string): string {
  const value = extra[key];
  if (value == null || value === "") return "-";
  return String(value);
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return "-";
  if (start && end && start !== end) {
    return `${formatDate(start)} ~ ${formatDate(end)}`;
  }
  return formatDate(start ?? end);
}


