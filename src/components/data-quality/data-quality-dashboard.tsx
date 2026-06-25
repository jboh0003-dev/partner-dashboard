"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { CsvDownloadButton } from "@/components/common/csv-download-button";
import { EmptyState } from "@/components/common/empty-state";
import { PARTNER_GRADE_LABEL, PARTNER_GRADE_ORDER } from "@/lib/constants";
import {
  DATA_QUALITY_ISSUE_LABEL,
  DATA_QUALITY_SECTION_LABEL,
  filterDataQualityRows,
  rowsToCsv,
  type DataQualityBundle,
  type DataQualityRow,
  type DataQualitySection
} from "@/lib/data/data-quality-shared";
import { getDocumentTypeShortLabel } from "@/lib/documents/display";
import { formatDate } from "@/lib/utils";

const SECTIONS: Array<{ key: DataQualitySection; label: string }> = [
  { key: "documents", label: "문서 점검" },
  { key: "contacts", label: "담당자 점검" },
  { key: "assets", label: "장비/리소스 점검" },
  { key: "training", label: "교육 데이터 점검" }
];

type DataQualityDashboardProps = {
  bundle: DataQualityBundle;
};

export function DataQualityDashboard({ bundle }: DataQualityDashboardProps) {
  const [activeSection, setActiveSection] = useState<DataQualitySection>("documents");
  const [issueType, setIssueType] = useState("all");
  const [grade, setGrade] = useState("all");
  const [documentType, setDocumentType] = useState("all");
  const [needsReview, setNeedsReview] = useState("all");
  const [query, setQuery] = useState("");

  const sectionRows = useMemo(
    () => bundle.rows.filter((row) => row.section === activeSection),
    [bundle.rows, activeSection]
  );

  const issueOptions = useMemo(() => {
    const types = new Set(sectionRows.map((row) => row.issueType));
    return Array.from(types).map((type) => ({
      value: type,
      label: DATA_QUALITY_ISSUE_LABEL[type]
    }));
  }, [sectionRows]);

  const filteredRows = useMemo(
    () =>
      filterDataQualityRows(sectionRows, {
        section: activeSection,
        issueType,
        grade,
        documentType,
        needsReview,
        q: query
      }),
    [sectionRows, activeSection, issueType, grade, documentType, needsReview, query]
  );

  const csvRows = useMemo(() => rowsToCsv(filteredRows), [filteredRows]);

  const sectionCounts = useMemo(() => {
    const counts: Record<DataQualitySection, number> = {
      documents: 0,
      contacts: 0,
      assets: 0,
      training: 0
    };
    for (const row of bundle.rows) counts[row.section] += 1;
    return counts;
  }, [bundle.rows]);

  return (
    <div className="space-y-6">
      {bundle.errors.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">일부 데이터 조회에 실패했습니다.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {bundle.errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <SummaryCard label="전체 파트너" value={bundle.summary.totalPartners} />
        <SummaryCard label="계약서 등록" value={bundle.summary.withContract} tone="emerald" />
        <SummaryCard label="계약서 미등록" value={bundle.summary.withoutContract} tone="rose" />
        <SummaryCard label="신청서 등록" value={bundle.summary.withApplication} tone="emerald" />
        <SummaryCard label="신청서 미등록" value={bundle.summary.withoutApplication} tone="rose" />
        <SummaryCard label="담당자 없음" value={bundle.summary.withoutContacts} tone="amber" />
        <SummaryCard label="장비 보유 파트너" value={bundle.summary.withAssets} />
        <SummaryCard label="확인 필요 문서" value={bundle.summary.needsReviewDocuments} tone="amber" />
        <SummaryCard label="매칭 실패 문서" value={bundle.summary.unmatchedDocuments} tone="rose" />
      </section>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {SECTIONS.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => {
              setActiveSection(section.key);
              setIssueType("all");
            }}
            className={[
              "rounded-t-lg px-4 py-2.5 text-sm font-semibold transition",
              activeSection === section.key
                ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            ].join(" ")}
          >
            {section.label}
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({sectionCounts[section.key].toLocaleString("ko-KR")})
            </span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FilterField label="문제 유형">
              <select
                value={issueType}
                onChange={(event) => setIssueType(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">전체</option>
                {issueOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="파트너 등급">
              <select
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">전체</option>
                {PARTNER_GRADE_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {PARTNER_GRADE_LABEL[key]}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="문서 구분">
              <select
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                disabled={activeSection !== "documents"}
              >
                <option value="all">전체</option>
                {[
                  "partner_contract",
                  "partner_application",
                  "business_registration",
                  "bank_account",
                  "company_profile",
                  "credit_rating",
                  "other"
                ].map((type) => (
                  <option key={type} value={type}>
                    {getDocumentTypeShortLabel(type)}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="확인 필요">
              <select
                value={needsReview}
                onChange={(event) => setNeedsReview(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="all">전체</option>
                <option value="yes">확인 필요만</option>
                <option value="no">확인 필요 제외</option>
              </select>
            </FilterField>
            <FilterField label="검색어">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="파트너사, 상세 내용"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
              />
            </FilterField>
          </div>
          <CsvDownloadButton
            rows={csvRows}
            filenamePrefix={`data-quality-${activeSection}`}
            label="섹션 CSV"
          />
        </div>

        <p className="mt-4 text-xs text-slate-500">
          {DATA_QUALITY_SECTION_LABEL[activeSection]} ·{" "}
          <span className="font-semibold text-slate-700">
            {filteredRows.length.toLocaleString("ko-KR")}
          </span>
          건 · 기준 시각 {new Date(bundle.fetchedAt).toLocaleString("ko-KR")}
        </p>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          title="점검 결과가 없습니다."
          description="현재 필터 조건에 해당하는 데이터 품질 이슈가 없습니다."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[1100px] w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {["파트너사", "등급", "계약일자", "문제 유형", "상세 내용", "바로가기"].map(
                  (label) => (
                    <th
                      key={label}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {label}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <QualityRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QualityRow({ row }: { row: DataQualityRow }) {
  const actions = getRowActions(row);

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.partnerName}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{row.gradeLabel}</td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {row.contractDate ? formatDate(row.contractDate) : "-"}
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        <span
          className={[
            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
            row.needsReview
              ? "bg-amber-100 text-amber-800"
              : "bg-slate-100 text-slate-700"
          ].join(" ")}
        >
          {row.issueLabel}
        </span>
      </td>
      <td className="max-w-md px-4 py-3 text-sm text-slate-600">
        <span className="break-words" title={row.detail}>
          {row.detail}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
            >
              {action.label}
              <ExternalLink size={11} />
            </Link>
          ))}
        </div>
      </td>
    </tr>
  );
}

function getRowActions(row: DataQualityRow) {
  const actions: Array<{ label: string; href: string }> = [];

  if (row.links.partnerDetail) {
    actions.push({ label: "파트너 상세", href: row.links.partnerDetail });
  }

  if (row.section === "documents" && row.links.documentsTab) {
    actions.push({ label: "문서 탭", href: row.links.documentsTab });
    if (row.links.documentManage) {
      actions.push({
        label: row.needsReview ? "문서 관리(확인필요)" : "문서 관리",
        href: row.links.documentManage
      });
    }
  }

  if (row.section === "contacts" && row.links.organizationTab) {
    actions.push({ label: "담당자 탭", href: row.links.organizationTab });
    if (row.links.contactsList) {
      actions.push({ label: "담당자 목록", href: row.links.contactsList });
    }
  }

  if (row.section === "assets" && row.links.assetsTab) {
    actions.push({ label: "장비/리소스 탭", href: row.links.assetsTab });
  }

  if (row.section === "training" && row.links.trainingsTab) {
    actions.push({ label: "교육 이력 탭", href: row.links.trainingsTab });
  }

  return actions;
}

function SummaryCard({
  label,
  value,
  tone = "slate"
}: {
  label: string;
  value: number;
  tone?: "slate" | "emerald" | "rose" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
        ? "text-rose-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-slate-950";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>
        {value.toLocaleString("ko-KR")}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      {children}
    </label>
  );
}
