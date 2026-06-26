import { formatCount, formatEok } from "@/lib/performance/format";
import { fetchExecutivePerformanceStats, fetchPartnerPerformanceBundle } from "@/lib/data/partner-performance";
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
      answer:
        "등록된 파트너 실적/파이프라인 스냅샷이 없습니다. 실적/파이프라인 업로드 메뉴에서 엑셀을 먼저 등록해 주세요.",
      empty: true,
      menuLinks: [
        { label: "실적/파이프라인", href: "/dashboard/performance" },
        { label: "실적/파이프라인 업로드", href: "/dashboard/performance/upload" }
      ]
    });
  }

  const compact = compactSearchQuery(parsed.raw);
  const wantsNewReg = /신규등록/.test(compact);
  const wantsTop = /top|상위|순위/.test(compact.toLowerCase());
  const wantsRevenue = /매출/.test(compact) && !/파이프라인/.test(compact);

  if (partnerId && partnerName) {
    const bundle = await fetchPartnerPerformanceBundle(partnerId);
    const answer = [
      `${partnerName} 파트너 실적/파이프라인 (${latest.snapshot_date} 스냅샷 기준)`,
      `- 2026 수주예상 파이프라인: ${formatEok(bundle.win_forecast_amount_million)} / ${formatCount(bundle.win_forecast_count)}`,
      `- 2026 신규등록 파이프라인: ${formatEok(bundle.new_reg_amount_million)} / ${formatCount(bundle.new_reg_count)}`,
      `- 2025 매출: ${formatEok(bundle.revenue_amount_million)} / ${formatCount(bundle.revenue_count)}`
    ].join("\n");

    return pipelineResult({
      intent: "pipeline_lookup",
      answer,
      matchStrategy: "exact",
      partnerId,
      matchedPartner: { id: partnerId, name: partnerName, href: `/dashboard/partners/${partnerId}?tab=performance` },
      menuLinks: [
        { label: `${partnerName} 실적/파이프라인`, href: `/dashboard/partners/${partnerId}?tab=performance` },
        { label: "실적/파이프라인", href: "/dashboard/performance" }
      ],
      summaryCards: [
        { label: "수주예상", value: formatEok(bundle.win_forecast_amount_million) },
        { label: "신규등록", value: formatEok(bundle.new_reg_amount_million) },
        { label: "2025 매출", value: formatEok(bundle.revenue_amount_million) }
      ]
    });
  }

  if (wantsRevenue || (wantsTop && /매출/.test(compact))) {
    const lines = stats.revenue_top10
      .slice(0, 10)
      .map((row, index) => `${index + 1}. ${row.partner_name} — ${formatEok(row.product_revenue_million)} / ${formatCount(row.project_count)}`);
    return pipelineResult({
      intent: "pipeline_lookup",
      answer: `2025 파트너 매출 Top 10 (${latest.snapshot_date} 기준)\n${lines.join("\n")}`,
      sources: [{ type: "partner_knowledge", label: "파트너 매출 DB" }],
      menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }]
    });
  }

  if (wantsTop) {
    const rows = wantsNewReg ? stats.new_reg_top10 : stats.win_forecast_top10;
    const title = wantsNewReg ? "2026 신규등록 파트너 파이프라인 Top 10" : "2026 수주예상 파트너 파이프라인 Top 10";
    const lines = rows
      .slice(0, 10)
      .map((row, index) => `${index + 1}. ${row.partner_name} — ${formatEok(row.amount_million)} / ${formatCount(row.project_count)}`);
    return pipelineResult({
      intent: "pipeline_lookup",
      answer: `${title} (${latest.snapshot_date} 기준)\n${lines.join("\n")}`,
      menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }]
    });
  }

  const winShare =
    latest.total_pipeline_amount_million && latest.total_pipeline_amount_million > 0
      ? Math.round(
          ((latest.partner_pipeline_amount_million ?? 0) / latest.total_pipeline_amount_million) * 1000
        ) / 10
      : null;

  const answer = wantsNewReg
    ? `2026년 신규등록 파트너 파이프라인은 ${latest.snapshot_date} 스냅샷 기준 ${formatEok(latest.new_partner_pipeline_amount_million)}, ${formatCount(latest.new_partner_pipeline_count)}입니다.`
    : `2026년 수주예상 파트너 파이프라인은 ${latest.snapshot_date} 스냅샷 기준 ${formatEok(latest.partner_pipeline_amount_million)}, ${formatCount(latest.partner_pipeline_count)}입니다.${winShare != null ? ` 같은 기준 전체 수주예상 파이프라인 대비 약 ${winShare}% 수준입니다.` : ""}`;

  return pipelineResult({
    intent: "pipeline_lookup",
    answer,
    menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }],
    summaryCards: [
      { label: "수주예상 파트너", value: formatEok(latest.partner_pipeline_amount_million) },
      { label: "신규등록 파트너", value: formatEok(latest.new_partner_pipeline_amount_million) }
    ]
  });
}
