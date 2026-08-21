import { formatCount, formatEok, formatMillion, isFy26 } from "@/lib/performance/format";
import { queryHasExpectedWinHint } from "@/lib/search/entity-detect";
import { fetchExecutivePerformanceStats, fetchPartnerPerformanceBundle } from "@/lib/data/partner-performance";
import { isExpectedWinPartnerPipeline } from "@/lib/performance/expected-win";
import { compactSearchQuery } from "@/lib/search/query-normalize";
import type { ParsedSearchQuery, SearchResult } from "@/lib/search/types";

function pipelineResult(partial: Partial<SearchResult> & Pick<SearchResult, "answer" | "intent">): SearchResult {
  return {
    empty: false,
    matchedPartner: null,
    partners: [],
    contacts: [],
    items: [],
    matchStrategy: "none",
    confidence: 1,
    sources: [{ type: "partner_knowledge", label: "파트너 파이프라인 DB" }],
    ...partial
  };
}

function formatTiming(row: {
  expected_win_year?: string | null;
  expected_win_quarter?: string | null;
  expected_win_month?: string | null;
}): string {
  return [row.expected_win_year, row.expected_win_quarter, row.expected_win_month]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ") || "-";
}

export async function handlePipelineLookup(
  parsed: ParsedSearchQuery,
  partnerId: string | null,
  partnerName: string | null
): Promise<SearchResult> {
  const stats = await fetchExecutivePerformanceStats();
  const latest = stats.latest_snapshot;

  if (!latest) {
    return pipelineResult({
      intent: "pipeline_lookup",
      answer: "현재 등록된 데이터에서 확인되지 않습니다.",
      empty: true,
      menuLinks: [
        { label: "실적/파이프라인", href: "/dashboard/performance" },
        { label: "실적/파이프라인 업로드", href: "/dashboard/performance/upload" }
      ]
    });
  }

  const compact = compactSearchQuery(parsed.raw);
  const wantsExpected = queryHasExpectedWinHint(parsed.raw);
  const wantsTop = /top|상위|순위|가장많|최다/.test(compact.toLowerCase() + parsed.raw);
  const wantsRevenue = /매출/.test(compact) && !/파이프라인|영업기회|수주/.test(compact);
  const wantsCount = /몇건|건수|몇\s*건/.test(parsed.raw) || /몇건/.test(compact);

  if (partnerId && partnerName) {
    const bundle = await fetchPartnerPerformanceBundle(partnerId);
    const expectedRows = bundle.opportunities.filter(isExpectedWinPartnerPipeline);
    const listRows = wantsExpected
      ? expectedRows
      : bundle.opportunities.filter(
          (row) => row.is_partner_deal && row.is_product_revenue && isFy26(row.expected_win_year)
        );
    const projectLines = listRows.slice(0, 8).map(
      (row) =>
        `- ${row.customer_name ?? "-"} / ${row.project_name ?? "-"} / ${row.project_code} / ${row.win_probability_label ?? "-"} / ${formatTiming(row)} / ${formatMillion(row.product_amount_million)}`
    );

    const answer = wantsExpected
      ? [
          `${partnerName}의 현재 수주 예상 프로젝트는 ${formatCount(bundle.win_forecast_count)}입니다.`,
          `총 제품매출은 약 ${formatEok(bundle.win_forecast_amount_million)}이며, 주요 프로젝트는 다음과 같습니다.`,
          ...projectLines
        ].join("\n")
      : [
          `${partnerName} 파트너 파이프라인 (${latest.snapshot_date} 기준)`,
          `- 파트너 전체 영업기회: ${formatCount(bundle.all_opportunity_count)} · ${formatMillion(bundle.all_opportunity_amount_million)}`,
          `- 수주 예상 프로젝트: ${formatCount(bundle.win_forecast_count)} · ${formatMillion(bundle.win_forecast_amount_million)}`,
          `- 2025 매출: ${formatCount(bundle.revenue_count)} · ${formatMillion(bundle.revenue_amount_million)}`,
          projectLines.length ? "영업기회 프로젝트:" : "",
          ...projectLines
        ]
          .filter(Boolean)
          .join("\n");

    return pipelineResult({
      intent: "pipeline_lookup",
      answer,
      matchStrategy: "exact",
      partnerId,
      matchedPartner: { id: partnerId, name: partnerName, href: `/dashboard/partners/${partnerId}?tab=performance` },
      menuLinks: [
        { label: `${partnerName} 상세`, href: `/dashboard/partners/${partnerId}?tab=performance` },
        { label: "실적/파이프라인", href: "/dashboard/performance" }
      ],
      summaryCards: [
        { label: "전체 영업기회", value: formatCount(bundle.all_opportunity_count) },
        { label: "수주 예상", value: formatCount(bundle.win_forecast_count) },
        { label: "2025 매출", value: formatMillion(bundle.revenue_amount_million) }
      ]
    });
  }

  if (wantsRevenue || (wantsTop && /매출/.test(compact))) {
    const lines = stats.revenue_top10
      .slice(0, 10)
      .map(
        (row, index) =>
          `${index + 1}. ${row.partner_name} — ${formatMillion(row.product_revenue_million)} / ${formatCount(row.project_count)}`
      );
    return pipelineResult({
      intent: "pipeline_lookup",
      answer:
        lines.length > 0
          ? `2025 파트너 매출 Top 10 (${latest.snapshot_date} 기준)\n${lines.join("\n")}`
          : "현재 등록된 데이터에서 확인되지 않습니다.",
      empty: lines.length === 0,
      sources: [{ type: "partner_knowledge", label: "파트너 매출 DB" }],
      menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }]
    });
  }

  if (wantsTop && wantsExpected) {
    const byCount = [...stats.expected_win_top10].sort((a, b) => b.project_count - a.project_count);
    const lines = byCount
      .slice(0, 10)
      .map(
        (row, index) =>
          `${index + 1}. ${row.partner_name} — ${formatCount(row.project_count)} · ${formatMillion(row.amount_million)}`
      );
    return pipelineResult({
      intent: "pipeline_lookup",
      answer: `수주 예상 프로젝트 상위 파트너 (${latest.snapshot_date} 기준)\n${lines.join("\n") || "현재 등록된 데이터에서 확인되지 않습니다."}`,
      empty: lines.length === 0,
      menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }]
    });
  }

  if (wantsTop) {
    const rows = stats.all_opportunity_top10;
    const lines = rows
      .slice(0, 10)
      .map(
        (row, index) =>
          `${index + 1}. ${row.partner_name} — ${formatMillion(row.amount_million)} / ${formatCount(row.project_count)}`
      );
    return pipelineResult({
      intent: "pipeline_lookup",
      answer: `파트너 전체 영업기회 상위 (${latest.snapshot_date} 기준)\n${lines.join("\n")}`,
      menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }]
    });
  }

  const share =
    stats.all_opportunity_amount_million > 0
      ? Math.round((stats.expected_win_amount_million / stats.all_opportunity_amount_million) * 1000) / 10
      : null;

  const answer = wantsExpected
    ? `수주 예상 프로젝트는 ${latest.snapshot_date} 기준 ${formatCount(stats.expected_win_count)}, ${formatMillion(stats.expected_win_amount_million)}입니다. (50%(F)·75%·90%·100%, 50%(U) 제외)`
    : `파트너 전체 영업기회는 ${latest.snapshot_date} 기준 ${formatCount(stats.all_opportunity_count)}, ${formatMillion(stats.all_opportunity_amount_million)}입니다.${
        wantsCount ? "" : share != null ? ` 수주 예상은 ${formatCount(stats.expected_win_count)} · ${formatMillion(stats.expected_win_amount_million)} (${share}%)입니다.` : ""
      }`;

  return pipelineResult({
    intent: "pipeline_lookup",
    answer,
    menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }],
    summaryCards: [
      { label: "파트너 전체 영업기회", value: formatCount(stats.all_opportunity_count) },
      { label: "수주 예상", value: formatCount(stats.expected_win_count) }
    ]
  });
}
