"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HorizontalBarChart } from "@/components/dashboard/bar-chart";
import {
  ClientSortableTable,
  type SortableColumn
} from "@/components/common/client-sortable-table";
import { TableCopyToolbar } from "@/components/common/table-copy-toolbar";
import { useTableSelection } from "@/hooks/use-table-selection";
import { PerformanceMatchModal } from "@/components/performance/performance-match-modal";
import { formatCount, formatEok, formatMillion } from "@/lib/performance/format";
import { isFy26, isRegisteredYear2026 } from "@/lib/performance/format";
import {
  canManualMatchPerformance,
  needsPerformanceReview,
  performanceMatchStatusLabel
} from "@/lib/performance/match-status";
import type {
  ExecutivePerformanceStats,
  PartnerPerformanceSnapshot,
  PartnerPipelineOpportunity
} from "@/types/partner-performance";
import type { CopyableRow } from "@/lib/clipboard/table-copy";
import type { CsvRow } from "@/lib/csv";

type TabKey =
  | "summary"
  | "win_forecast"
  | "new_reg"
  | "top_win"
  | "top_new"
  | "top_revenue"
  | "review"
  | "raw";

type Filters = {
  partner: string;
  customer: string;
  division: string;
  fiscalYear: string;
  probability: string;
  matchStatus: string;
  amountMin: string;
  amountMax: string;
  search: string;
};

const DEFAULT_FILTERS: Filters = {
  partner: "",
  customer: "",
  division: "",
  fiscalYear: "",
  probability: "",
  matchStatus: "",
  amountMin: "",
  amountMax: "",
  search: ""
};

const COLUMN_DEFS = [
  { key: "raw_partner_name", label: "원본 파트너명" },
  { key: "matched_partner_name", label: "매칭 파트너명" },
  { key: "match_status", label: "매칭상태" },
  { key: "customer_name", label: "고객사" },
  { key: "project_name", label: "프로젝트" },
  { key: "project_code", label: "코드" },
  { key: "expected_win_year", label: "예상수주" },
  { key: "win_probability_label", label: "확도" },
  { key: "product_amount_million", label: "제품합계" },
  { key: "division", label: "본부" },
  { key: "match_reason", label: "검토 메모" }
] as const;

function displayPartnerName(row: PartnerPipelineOpportunity): string {
  if (row.match_status === "unknown_partner") return "파트너 미기재";
  return row.raw_partner_name ?? row.partner_name ?? "-";
}

export function PerformanceDetailPanel({
  snapshot,
  opportunities,
  stats
}: {
  snapshot: PartnerPerformanceSnapshot | null;
  opportunities: PartnerPipelineOpportunity[];
  stats: ExecutivePerformanceStats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<TabKey>("summary");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [localRows, setLocalRows] = useState(opportunities);
  const [matchTarget, setMatchTarget] = useState<PartnerPipelineOpportunity | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [savingMatch, setSavingMatch] = useState(false);

  useEffect(() => {
    setLocalRows(opportunities);
  }, [opportunities]);

  const reviewCount = useMemo(() => localRows.filter(needsPerformanceReview).length, [localRows]);

  const tabRows = useMemo(() => {
    switch (tab) {
      case "win_forecast":
        return localRows.filter(
          (row) => row.is_product_revenue && row.is_partner_deal && isFy26(row.expected_win_year)
        );
      case "new_reg":
        return localRows.filter(
          (row) =>
            row.is_product_revenue &&
            row.is_partner_deal &&
            isRegisteredYear2026(row.project_registered_year)
        );
      case "review":
        return localRows.filter(needsPerformanceReview);
      case "raw":
        return localRows;
      default:
        return localRows;
    }
  }, [tab, localRows]);

  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const min = filters.amountMin ? Number(filters.amountMin) : null;
    const max = filters.amountMax ? Number(filters.amountMax) : null;

    return tabRows.filter((row) => {
      if (filters.partner && !(row.raw_partner_name ?? row.partner_name ?? "").includes(filters.partner)) {
        return false;
      }
      if (filters.customer && !(row.customer_name ?? "").includes(filters.customer)) return false;
      if (filters.division && !(row.division ?? "").includes(filters.division)) return false;
      if (filters.fiscalYear && row.expected_win_year !== filters.fiscalYear) return false;
      if (filters.probability && row.win_probability_label !== filters.probability) return false;
      if (filters.matchStatus && row.match_status !== filters.matchStatus) return false;
      const amount = row.product_amount_million ?? 0;
      if (min != null && !Number.isNaN(min) && amount < min) return false;
      if (max != null && !Number.isNaN(max) && amount > max) return false;
      if (q) {
        const haystack = [
          row.raw_partner_name,
          row.partner_name,
          row.matched_partner_name,
          row.customer_name,
          row.project_name,
          row.project_code
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tabRows, filters]);

  const filterOptions = useMemo(() => {
    const divisions = new Set<string>();
    const years = new Set<string>();
    const probabilities = new Set<string>();
    const statuses = new Set<string>();
    for (const row of localRows) {
      if (row.division) divisions.add(row.division);
      if (row.expected_win_year) years.add(row.expected_win_year);
      if (row.win_probability_label) probabilities.add(row.win_probability_label);
      if (row.match_status) statuses.add(row.match_status);
    }
    return {
      divisions: Array.from(divisions).sort(),
      years: Array.from(years).sort(),
      probabilities: Array.from(probabilities).sort(),
      statuses: Array.from(statuses).sort()
    };
  }, [localRows]);

  const amountSum = useMemo(
    () => filteredRows.reduce((sum, row) => sum + (row.product_amount_million ?? 0), 0),
    [filteredRows]
  );

  const selection = useTableSelection(filteredRows, (row) => row.id);

  const copyableRows: CopyableRow[] = useMemo(
    () =>
      filteredRows.map((row) => ({
        id: row.id,
        company_name: displayPartnerName(row),
        name: row.matched_partner_name ?? "",
        email: row.customer_name ?? "",
        phone: row.project_code
      })),
    [filteredRows]
  );

  const csvRows: CsvRow[] = useMemo(
    () =>
      filteredRows.map((row) => ({
        원본파트너명: displayPartnerName(row),
        매칭파트너명: row.matched_partner_name ?? "",
        매칭상태: performanceMatchStatusLabel(row.match_status),
        고객사: row.customer_name ?? "",
        프로젝트: row.project_name ?? "",
        코드: row.project_code,
        예상수주: row.expected_win_year ?? "",
        확도: row.win_probability_label ?? "",
        제품합계: row.product_amount_million ?? "",
        본부: row.division ?? "",
        검토메모: row.match_reason ?? row.review_memo ?? ""
      })),
    [filteredRows]
  );

  const applyOpportunityPatch = useCallback(
    (rowId: string, patch: Partial<PartnerPipelineOpportunity>) => {
      setLocalRows((current) =>
        current.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
      );
    },
    []
  );

  const runMatchAction = useCallback(
    async (
      row: PartnerPipelineOpportunity,
      action: "match" | "not_partner",
      partnerId?: string,
      saveAlias?: boolean
    ) => {
      setActionError(null);
      setActionMessage(null);
      setSavingMatch(true);
      try {
        const response = await fetch(`/api/performance/opportunities/${row.id}/match`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            partner_id: partnerId,
            save_alias: saveAlias,
            raw_partner_name: row.raw_partner_name ?? row.partner_name
          })
        });
        const json = await response.json();
        if (!response.ok || !json.ok) {
          throw new Error(json.message ?? "처리 실패");
        }

        const updated = json.opportunity as Record<string, unknown>;
        applyOpportunityPatch(row.id, {
          matched_partner_id: updated.matched_partner_id
            ? String(updated.matched_partner_id)
            : null,
          matched_partner_name: updated.matched_partner_name
            ? String(updated.matched_partner_name)
            : null,
          match_status: updated.match_status ? String(updated.match_status) : null,
          match_reason: updated.match_reason ? String(updated.match_reason) : null,
          review_memo: updated.review_memo ? String(updated.review_memo) : null
        });

        if (action === "match") {
          setActionMessage(
            json.alias_saved
              ? `「${row.raw_partner_name ?? row.partner_name}」 별칭 저장 후 매칭했습니다.`
              : "파트너 매칭을 저장했습니다."
          );
        } else {
          setActionMessage("파트너 아님으로 저장했습니다.");
        }

        setMatchTarget(null);
        startTransition(() => router.refresh());
        return true;
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "처리 실패");
        return false;
      } finally {
        setSavingMatch(false);
      }
    },
    [applyOpportunityPatch, router, startTransition]
  );

  const columns: SortableColumn<PartnerPipelineOpportunity>[] = useMemo(() => {
    const defs: SortableColumn<PartnerPipelineOpportunity>[] = [
      {
        key: "raw_partner_name",
        label: "원본 파트너명",
        kind: "text",
        value: (row) => displayPartnerName(row),
        render: (row) => (
          <span className={row.match_status === "unknown_partner" ? "text-amber-700" : ""}>
            {displayPartnerName(row)}
          </span>
        )
      },
      {
        key: "matched_partner_name",
        label: "매칭 파트너명",
        kind: "text",
        value: (row) => row.matched_partner_name ?? "",
        render: (row) =>
          row.matched_partner_id ? (
            <Link
              href={`/dashboard/partners/${row.matched_partner_id}?tab=performance`}
              className="text-okestro-600 select-text hover:underline"
            >
              {row.matched_partner_name ?? "-"}
            </Link>
          ) : (
            <span className="text-slate-400">-</span>
          )
      },
      {
        key: "match_status",
        label: "매칭상태",
        kind: "text",
        value: (row) => row.match_status ?? "",
        render: (row) => performanceMatchStatusLabel(row.match_status)
      },
      {
        key: "customer_name",
        label: "고객사",
        kind: "text",
        value: (row) => row.customer_name ?? "",
        render: (row) => row.customer_name ?? "-"
      },
      {
        key: "project_name",
        label: "프로젝트",
        kind: "text",
        value: (row) => row.project_name ?? "",
        render: (row) => row.project_name ?? "-"
      },
      {
        key: "project_code",
        label: "코드",
        kind: "text",
        value: (row) => row.project_code,
        render: (row) => row.project_code
      },
      {
        key: "expected_win_year",
        label: "예상수주",
        kind: "text",
        value: (row) => row.expected_win_year ?? "",
        render: (row) => row.expected_win_year ?? "-"
      },
      {
        key: "win_probability_label",
        label: "확도",
        kind: "text",
        value: (row) => row.win_probability_label ?? "",
        render: (row) => row.win_probability_label ?? "-"
      },
      {
        key: "product_amount_million",
        label: "제품합계",
        kind: "number",
        align: "right",
        value: (row) => row.product_amount_million ?? 0,
        render: (row) => formatMillion(row.product_amount_million)
      },
      {
        key: "division",
        label: "본부",
        kind: "text",
        value: (row) => row.division ?? "",
        render: (row) => row.division ?? "-"
      },
      {
        key: "match_reason",
        label: "검토 메모",
        kind: "text",
        className: "min-w-[10rem]",
        value: (row) => row.match_reason ?? row.review_memo ?? "",
        render: (row) => (
          <span className="text-xs text-amber-800">{row.match_reason ?? row.review_memo ?? "-"}</span>
        )
      }
    ];

    if (tab === "review") {
      defs.push({
        key: "actions",
        label: "액션",
        kind: "text",
        value: () => "",
        render: (row) =>
          canManualMatchPerformance(row) ? (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                disabled={isPending || savingMatch}
                onClick={() => {
                  setActionError(null);
                  setActionMessage(null);
                  setMatchTarget(row);
                }}
                className="rounded border border-okestro-200 bg-okestro-50 px-2 py-1 text-[11px] font-semibold text-okestro-700 hover:bg-okestro-100"
              >
                파트너 매칭
              </button>
              <button
                type="button"
                disabled={isPending || savingMatch}
                onClick={() => void runMatchAction(row, "not_partner")}
                className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                파트너 아님
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400">처리 완료</span>
          )
      });
    }

    return defs.filter((col) => !hiddenColumns.has(col.key));
  }, [hiddenColumns, isPending, runMatchAction, savingMatch, tab]);

  if (!snapshot) return null;

  const latest = stats.latest_snapshot!;

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">상세 분석</h2>
          <p className="text-xs text-slate-500">
            스냅샷 {snapshot.snapshot_label} ({snapshot.snapshot_date}) · 영업기회{" "}
            {localRows.length.toLocaleString("ko-KR")}건
            {reviewCount > 0 ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                검토 필요 {reviewCount}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/performance/upload"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            업로드
          </Link>
          <a
            href={`/api/performance/export?snapshot_id=${snapshot.id}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            엑셀 다운로드
          </a>
        </div>
      </div>

      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      {actionMessage ? <p className="text-sm text-emerald-700">{actionMessage}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["summary", "Executive Summary"],
            ["win_forecast", "수주예상 파이프라인"],
            ["new_reg", "신규등록 파이프라인"],
            ["top_win", "수주예상 Top 10"],
            ["top_new", "신규등록 Top 10"],
            ["top_revenue", "매출 Top 10"],
            ["review", `검토 필요 (${reviewCount})`],
            ["raw", "원천 데이터"]
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? "rounded-lg bg-okestro-600 px-3 py-2 text-sm font-semibold text-white"
                : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <SummaryCard
            title="2026 수주예상 파트너 파이프라인"
            amount={latest.partner_pipeline_amount_million}
            count={latest.partner_pipeline_count}
            total={latest.total_pipeline_amount_million}
          />
          <SummaryCard
            title="2026 신규등록 파트너 파이프라인"
            amount={latest.new_partner_pipeline_amount_million}
            count={latest.new_partner_pipeline_count}
            total={latest.new_total_pipeline_amount_million}
          />
        </div>
      ) : null}

      {tab === "top_win" ? (
        <HorizontalBarChart
          data={stats.win_forecast_top10.map((row) => ({
            label: row.partner_name,
            value: row.amount_million
          }))}
        />
      ) : null}
      {tab === "top_new" ? (
        <HorizontalBarChart
          data={stats.new_reg_top10.map((row) => ({
            label: row.partner_name,
            value: row.amount_million
          }))}
        />
      ) : null}
      {tab === "top_revenue" ? (
        <HorizontalBarChart
          data={stats.revenue_top10.map((row) => ({
            label: row.partner_name,
            value: row.product_revenue_million
          }))}
        />
      ) : null}

      {["win_forecast", "new_reg", "review", "raw"].includes(tab) ? (
        <>
          <FilterToolbar
            filters={filters}
            onChange={setFilters}
            options={filterOptions}
            hiddenColumns={hiddenColumns}
            onToggleColumn={(key) => {
              setHiddenColumns((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
          />

          <TableCopyToolbar
            allRows={copyableRows}
            selectedIds={selection.selectedIds}
            selectedCount={selection.selectedCount}
            totalCount={filteredRows.length}
            onClearSelection={selection.clearSelection}
            selectedRowTsv={{
              headers: COLUMN_DEFS.map((c) => c.label),
              getValues: (row) => {
                const opp = filteredRows.find((item) => item.id === row.id);
                if (!opp) return [];
                return [
                  displayPartnerName(opp),
                  opp.matched_partner_name ?? "",
                  performanceMatchStatusLabel(opp.match_status),
                  opp.customer_name ?? "",
                  opp.project_name ?? "",
                  opp.project_code,
                  opp.expected_win_year ?? "",
                  opp.win_probability_label ?? "",
                  String(opp.product_amount_million ?? ""),
                  opp.division ?? "",
                  opp.match_reason ?? opp.review_memo ?? ""
                ];
              }
            }}
            csvRows={csvRows}
            csvFilenamePrefix={`performance-${snapshot.snapshot_label}`}
          />

          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <span>
              필터 결과 제품합계: <strong>{formatMillion(amountSum)}</strong>
            </span>
            {selection.selectedCount > 0 ? (
              <span>
                선택 행 제품합계:{" "}
                <strong>
                  {formatMillion(
                    filteredRows
                      .filter((row) => selection.selectedIds.has(row.id))
                      .reduce((sum, row) => sum + (row.product_amount_million ?? 0), 0)
                  )}
                </strong>
              </span>
            ) : null}
          </div>

          <ClientSortableTable
            rows={filteredRows}
            columns={columns}
            defaultSortKey="product_amount_million"
            defaultDir="desc"
            minWidth="1200px"
            rowKey={(row) => row.id}
            selectable
            selectedIds={selection.selectedIds}
            onToggleRow={selection.toggleRow}
            onToggleAll={selection.toggleAll}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
          />
        </>
      ) : null}

      <PerformanceMatchModal
        open={matchTarget != null}
        rawPartnerName={matchTarget?.raw_partner_name ?? matchTarget?.partner_name ?? ""}
        saving={savingMatch}
        onClose={() => {
          if (!savingMatch) setMatchTarget(null);
        }}
        onSelect={(partner, saveAlias) => {
          if (!matchTarget || savingMatch) return;
          void runMatchAction(matchTarget, "match", partner.id, saveAlias);
        }}
      />
    </section>
  );
}

function SummaryCard({
  title,
  amount,
  count,
  total
}: {
  title: string;
  amount: number | null;
  count: number | null;
  total: number | null;
}) {
  const share =
    total && total > 0 && amount ? Math.round((amount / total) * 1000) / 10 : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{formatEok(amount)}</p>
      <p className="mt-1 text-sm text-slate-600">
        {formatCount(count)} · {formatMillion(amount)}
      </p>
      <p className="mt-2 text-xs text-slate-500">전체 대비 약 {share}%</p>
    </div>
  );
}

function FilterToolbar({
  filters,
  onChange,
  options,
  hiddenColumns,
  onToggleColumn
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  options: {
    divisions: string[];
    years: string[];
    probabilities: string[];
    statuses: string[];
  };
  hiddenColumns: Set<string>;
  onToggleColumn: (key: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <FilterInput
          label="파트너"
          value={filters.partner}
          onChange={(partner) => onChange({ ...filters, partner })}
        />
        <FilterInput
          label="고객사"
          value={filters.customer}
          onChange={(customer) => onChange({ ...filters, customer })}
        />
        <FilterSelect
          label="본부"
          value={filters.division}
          onChange={(division) => onChange({ ...filters, division })}
          options={options.divisions}
        />
        <FilterSelect
          label="FY"
          value={filters.fiscalYear}
          onChange={(fiscalYear) => onChange({ ...filters, fiscalYear })}
          options={options.years}
        />
        <FilterSelect
          label="확도"
          value={filters.probability}
          onChange={(probability) => onChange({ ...filters, probability })}
          options={options.probabilities}
        />
        <FilterSelect
          label="match_status"
          value={filters.matchStatus}
          onChange={(matchStatus) => onChange({ ...filters, matchStatus })}
          options={options.statuses}
          formatOption={performanceMatchStatusLabel}
        />
        <FilterInput
          label="제품합계 최소"
          value={filters.amountMin}
          onChange={(amountMin) => onChange({ ...filters, amountMin })}
          type="number"
        />
        <FilterInput
          label="제품합계 최대"
          value={filters.amountMax}
          onChange={(amountMax) => onChange({ ...filters, amountMax })}
          type="number"
        />
      </div>
      <input
        type="search"
        value={filters.search}
        onChange={(e) => onChange({ ...filters, search: e.target.value })}
        placeholder="파트너명, 고객사, 프로젝트명, 코드 검색"
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-500">컬럼 표시</span>
        {COLUMN_DEFS.map((col) => (
          <label key={col.key} className="inline-flex items-center gap-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={!hiddenColumns.has(col.key)}
              onChange={() => onToggleColumn(col.key)}
              className="rounded border-slate-300"
            />
            {col.label}
          </label>
        ))}
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="ml-auto text-xs font-semibold text-okestro-600 hover:underline"
        >
          필터 초기화
        </button>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  formatOption
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  formatOption?: (value: string) => string;
}) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
      >
        <option value="">전체</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {formatOption ? formatOption(option) : option}
          </option>
        ))}
      </select>
    </label>
  );
}
