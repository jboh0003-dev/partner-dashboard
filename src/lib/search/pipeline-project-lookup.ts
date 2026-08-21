import { createAdminClient } from "@/lib/supabase/admin";
import { formatMillion } from "@/lib/performance/format";
import type { SearchResult } from "@/lib/search/types";

export async function lookupOpportunityByProjectCode(projectCode: string): Promise<SearchResult> {
  const code = projectCode.trim().toUpperCase();
  const supabase = createAdminClient();
  const { data: snapshot } = await supabase
    .from("partner_performance_snapshots")
    .select("id, snapshot_date")
    .eq("is_current", true)
    .maybeSingle();

  if (!snapshot?.id) {
    return {
      answer: "현재 등록된 데이터에서 확인되지 않습니다.",
      intent: "pipeline_lookup",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources: [{ type: "partner_knowledge", label: "파트너 파이프라인 DB" }],
      matchStrategy: "none",
      menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }]
    };
  }

  const { data } = await supabase
    .from("partner_pipeline_opportunities")
    .select(
      "project_code, customer_name, project_name, partner_name, matched_partner_id, matched_partner_name, win_probability_label, product_amount_million, expected_win_year, expected_win_quarter"
    )
    .eq("snapshot_id", snapshot.id)
    .ilike("project_code", code)
    .limit(5);

  const row = (data ?? [])[0];
  if (!row) {
    return {
      answer: "현재 등록된 데이터에서 확인되지 않습니다.",
      intent: "pipeline_lookup",
      empty: true,
      matchedPartner: null,
      partners: [],
      contacts: [],
      items: [],
      sources: [{ type: "partner_knowledge", label: "파트너 파이프라인 DB" }],
      matchStrategy: "none",
      menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }]
    };
  }

  const partnerName = String(row.matched_partner_name ?? row.partner_name ?? "-");
  const partnerId = row.matched_partner_id ? String(row.matched_partner_id) : null;
  return {
    answer: [
      `프로젝트 ${String(row.project_code)}`,
      `고객: ${String(row.customer_name ?? "-")}`,
      `프로젝트명: ${String(row.project_name ?? "-")}`,
      `파트너: ${partnerName}`,
      `수주확도: ${String(row.win_probability_label ?? "-")}`,
      `금액: ${formatMillion(Number(row.product_amount_million ?? 0))}`,
      `예상: ${[row.expected_win_year, row.expected_win_quarter].filter(Boolean).join(" ") || "-"}`
    ].join("\n"),
    intent: "pipeline_lookup",
    empty: false,
    matchedPartner: partnerId
      ? { id: partnerId, name: partnerName, href: `/dashboard/partners/${partnerId}?tab=performance` }
      : null,
    partners: partnerId
      ? [{ id: partnerId, name: partnerName, href: `/dashboard/partners/${partnerId}` }]
      : [],
    contacts: [],
    items: [
      {
        id: String(row.project_code),
        title: String(row.project_name ?? row.project_code),
        subtitle: `${partnerName} · ${String(row.win_probability_label ?? "-")}`,
        href: partnerId ? `/dashboard/partners/${partnerId}?tab=performance` : "/dashboard/performance"
      }
    ],
    sources: [{ type: "partner_knowledge", label: "파트너 파이프라인 DB" }],
    matchStrategy: "exact",
    menuLinks: [{ label: "실적/파이프라인", href: "/dashboard/performance" }]
  };
}
