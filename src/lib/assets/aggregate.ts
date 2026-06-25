import { PARTNER_GRADE_LABEL } from "@/lib/constants";
import {
  formatComputeNodeCountLabel,
  formatControlNodeCountLabel,
  pickLatestUpdatedAt,
  pickPartnerAssetStatus,
  pickRepresentativeAsset,
  sortAssetsByNodeOrder
} from "@/lib/assets/node-utils";
import { isSamplePartnerName } from "@/lib/partners/sample-filter";
import type { PartnerAsset } from "@/types/asset";

export type AssetListRowForAggregate = PartnerAsset & {
  partner_name: string;
  partner_grade: string | null;
  partner_grade_label: string;
};

export type AssetPartnerSummary = {
  partner_id: string;
  partner_name: string;
  partner_grade: string | null;
  partner_grade_label: string;
  asset_status: string | null;
  control_node_label: string;
  compute_node_label: string;
  representative_cpu: string | null;
  representative_memory: string | null;
  representative_os_disk: string | null;
  representative_ceph_disk: string | null;
  representative_nic: string | null;
  latest_updated_at: string | null;
  nodes: AssetListRowForAggregate[];
};

export function aggregateAssetsByPartner(rows: AssetListRowForAggregate[]): AssetPartnerSummary[] {
  const grouped = new Map<string, AssetListRowForAggregate[]>();

  for (const row of rows) {
    if (isSamplePartnerName(row.partner_name)) continue;
    const current = grouped.get(row.partner_id) ?? [];
    current.push(row);
    grouped.set(row.partner_id, current);
  }

  return Array.from(grouped.entries())
    .map(([partner_id, nodes]) => buildPartnerSummary(partner_id, nodes))
    .sort((left, right) =>
      left.partner_name.localeCompare(right.partner_name, "ko-KR", { numeric: true })
    );
}

function buildPartnerSummary(partnerId: string, nodes: AssetListRowForAggregate[]): AssetPartnerSummary {
  const sortedNodes = sortAssetsByNodeOrder(nodes);
  const representative = pickRepresentativeAsset(sortedNodes);
  const first = sortedNodes[0];

  return {
    partner_id: partnerId,
    partner_name: first?.partner_name ?? "(미상)",
    partner_grade: first?.partner_grade ?? null,
    partner_grade_label: first?.partner_grade_label ?? "-",
    asset_status: pickPartnerAssetStatus(sortedNodes),
    control_node_label: formatControlNodeCountLabel(sortedNodes),
    compute_node_label: formatComputeNodeCountLabel(sortedNodes),
    representative_cpu: representative?.cpu ?? null,
    representative_memory: representative?.memory ?? null,
    representative_os_disk: representative?.os_disk ?? null,
    representative_ceph_disk: representative?.ceph_disk ?? null,
    representative_nic: representative?.nic ?? null,
    latest_updated_at: pickLatestUpdatedAt(sortedNodes),
    nodes: sortedNodes
  };
}

export function countDistinctEquipmentPartners(rows: AssetListRowForAggregate[]): number {
  return new Set(
    rows.filter((row) => !isSamplePartnerName(row.partner_name)).map((row) => row.partner_id)
  ).size;
}

export function formatPartnerGradeLabel(grade: string | null): string {
  return PARTNER_GRADE_LABEL[grade ?? "none"] ?? grade ?? "-";
}
