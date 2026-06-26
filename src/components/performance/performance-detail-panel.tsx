"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HorizontalBarChart } from "@/components/dashboard/bar-chart";
import { formatCount, formatEok, formatMillion } from "@/lib/performance/format";
import { isFy26, isRegisteredYear2026 } from "@/lib/performance/format";
import type { PartnerPerformanceSnapshot, PartnerPipelineOpportunity } from "@/types/partner-performance";

type TabKey = "partners" | "opportunities" | "review";

export function PerformanceDetailPanel({
  snapshot,
  opportunities
}: {
  snapshot: PartnerPerformanceSnapshot | null;
  opportunities: PartnerPipelineOpportunity[];
}) {
  const [tab, setTab] = useState<TabKey>("partners");
  const [query, setQuery] = useState("");

  const partnerRows = useMemo(() => {
    const map = new Map<
      string,
      {
        partner_name: string;
        matched_partner_id: string | null;
        partner_grade: string | null;
        win_amount: number;
        win_count: Set<string>;
        new_amount: number;
        new_count: Set<string>;
        customers: Set<string>;
        projects: Set<string>;
      }
    >();

    for (const row of opportunities) {
      if (!row.partner_name?.trim() || !row.is_partner_deal || !row.is_product_revenue) continue;
      const key = row.matched_partner_id ?? row.partner_name.trim();
      const entry = map.get(key) ?? {
        partner_name: row.partner_name.trim(),
        matched_partner_id: row.matched_partner_id,
        partner_grade: row.partner_grade,
        win_amount: 0,
        win_count: new Set<string>(),
        new_amount: 0,
        new_count: new Set<string>(),
        customers: new Set<string>(),
        projects: new Set<string>()
      };
      if (isFy26(row.expected_win_year)) {
        entry.win_amount += row.product_amount_million ?? 0;
        if (row.project_code) entry.win_count.add(row.project_code);
      }
      if (isRegisteredYear2026(row.project_registered_year)) {
        entry.new_amount += row.product_amount_million ?? 0;
        if (row.project_code) entry.new_count.add(row.project_code);
      }
      if (row.customer_name) entry.customers.add(row.customer_name);
      if (row.project_name) entry.projects.add(row.project_name);
      map.set(key, entry);
    }

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        win_count: row.win_count.size,
        new_count: row.new_count.size,
        top_customers: Array.from(row.customers).slice(0, 2).join(", "),
        top_projects: Array.from(row.projects).slice(0, 2).join(", ")
      }))
      .sort((a, b) => b.win_amount - a.win_amount);
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opportunities.slice(0, 300);
    return opportunities
      .filter((row) =>
        [row.partner_name, row.customer_name, row.project_name, row.project_code, row.sales_owner]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      )
      .slice(0, 300);
  }, [opportunities, query]);

  const reviewRows = opportunities.filter((row) => !row.matched_partner_id && row.partner_name?.trim());

  if (!snapshot) return null;

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">상세 분석</h2>
          <p className="text-xs text-slate-500">스냅샷 {snapshot.snapshot_label} · 영업기회 {opportunities.length}건</p>
        </div>
        <a
          href={`/api/performance/export?snapshot_id=${snapshot.id}`}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          엑셀 다운로드
        </a>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["partners", "파트너별"],
            ["opportunities", "영업기회별"],
            ["review", `검토필요 (${reviewRows.length})`]
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={tab === key ? "rounded-lg bg-okestro-600 px-3 py-2 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "partners" ? (
        <>
          <HorizontalBarChart
            data={partnerRows.slice(0, 10).map((row) => ({
              label: row.partner_name,
              value: Math.round(row.win_amount)
            }))}
          />
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">파트너사</th>
                  <th className="px-4 py-3 text-left">등급</th>
                  <th className="px-4 py-3 text-right">수주예상</th>
                  <th className="px-4 py-3 text-right">건수</th>
                  <th className="px-4 py-3 text-right">신규등록</th>
                  <th className="px-4 py-3 text-right">건수</th>
                  <th className="px-4 py-3 text-left">주요 고객/프로젝트</th>
                  <th className="px-4 py-3 text-left">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partnerRows.map((row) => (
                  <tr key={row.partner_name}>
                    <td className="px-4 py-2 font-medium">{row.partner_name}</td>
                    <td className="px-4 py-2">{row.partner_grade ?? "-"}</td>
                    <td className="px-4 py-2 text-right">{formatEok(row.win_amount)}</td>
                    <td className="px-4 py-2 text-right">{formatCount(row.win_count)}</td>
                    <td className="px-4 py-2 text-right">{formatEok(row.new_amount)}</td>
                    <td className="px-4 py-2 text-right">{formatCount(row.new_count)}</td>
                    <td className="px-4 py-2 text-xs text-slate-600">
                      {row.top_customers || "-"}
                      <br />
                      {row.top_projects || "-"}
                    </td>
                    <td className="px-4 py-2">
                      {row.matched_partner_id ? (
                        <Link href={`/dashboard/partners/${row.matched_partner_id}?tab=performance`} className="text-okestro-600 hover:underline">
                          파트너 상세
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === "opportunities" ? (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="파트너, 고객사, 프로젝트, 코드 검색"
            className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">파트너</th>
                  <th className="px-3 py-2 text-left">고객사</th>
                  <th className="px-3 py-2 text-left">프로젝트</th>
                  <th className="px-3 py-2 text-left">코드</th>
                  <th className="px-3 py-2 text-left">등록연도</th>
                  <th className="px-3 py-2 text-left">예상수주</th>
                  <th className="px-3 py-2 text-left">확도</th>
                  <th className="px-3 py-2 text-right">제품합계</th>
                  <th className="px-3 py-2 text-left">본부</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOpportunities.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">{row.partner_name ?? "-"}</td>
                    <td className="px-3 py-2">{row.customer_name ?? "-"}</td>
                    <td className="px-3 py-2">{row.project_name ?? "-"}</td>
                    <td className="px-3 py-2">{row.project_code}</td>
                    <td className="px-3 py-2">{row.project_registered_year ?? "-"}</td>
                    <td className="px-3 py-2">{row.expected_win_year ?? "-"}</td>
                    <td className="px-3 py-2">{row.win_probability_label ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{formatMillion(row.product_amount_million)}</td>
                    <td className="px-3 py-2">{row.division ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === "review" ? (
        <div className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50/40">
          <table className="min-w-full text-sm">
            <thead className="bg-amber-100/60 text-xs font-semibold uppercase text-amber-900">
              <tr>
                <th className="px-3 py-2 text-left">엑셀 파트너명</th>
                <th className="px-3 py-2 text-left">프로젝트</th>
                <th className="px-3 py-2 text-right">금액</th>
              </tr>
            </thead>
            <tbody>
              {reviewRows.slice(0, 100).map((row) => (
                <tr key={row.id} className="border-t border-amber-100">
                  <td className="px-3 py-2">{row.partner_name}</td>
                  <td className="px-3 py-2">{row.project_name ?? row.project_code}</td>
                  <td className="px-3 py-2 text-right">{formatMillion(row.product_amount_million)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
