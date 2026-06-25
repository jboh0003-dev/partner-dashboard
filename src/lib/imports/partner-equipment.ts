import { normalizeAssetNodeName } from "@/lib/assets/node-utils";
import type { ParsedPartnerEquipmentRow } from "@/lib/excel/parse-partner-equipment";
import { getExactCompanyNameKey, normalizeCompanyName } from "@/lib/partner-match";

export type PartnerEquipmentPartnerRow = {
  id: string;
  company_name: string;
};

export type PartnerEquipmentDbRow = {
  id: string;
  partner_id: string;
  asset_type: string | null;
  spec_summary: string | null;
  asset_name: string | null;
  node_name: string | null;
};

export type PartnerEquipmentAnalysisAction = "create" | "update" | "skip" | "review";

export type PartnerEquipmentAnalysisItem = {
  row_number: number;
  company_name: string;
  node_name: string | null;
  node_type: string | null;
  cpu: string | null;
  memory: string | null;
  os_disk: string | null;
  ceph_disk: string | null;
  nic: string | null;
  asset_status: string | null;
  memo: string | null;
  asset_type: string | null;
  spec_summary: string | null;
  quantity: number | null;
  action: PartnerEquipmentAnalysisAction;
  reason: string;
  matched_partner_id: string | null;
  matched_partner_name: string | null;
  matched_asset_id: string | null;
};

export type PartnerEquipmentAnalysisSummary = {
  total: number;
  partner_count: number;
  matched_partners: number;
  unmatched_partners: number;
  create: number;
  update: number;
  skip: number;
  review: number;
};

export function analyzePartnerEquipmentRows(
  rows: ParsedPartnerEquipmentRow[],
  partners: PartnerEquipmentPartnerRow[],
  assets: PartnerEquipmentDbRow[]
): {
  items: PartnerEquipmentAnalysisItem[];
  summary: PartnerEquipmentAnalysisSummary;
} {
  const partnersByExactName = new Map<string, PartnerEquipmentPartnerRow[]>();
  const partnersByNormalizedName = new Map<string, PartnerEquipmentPartnerRow[]>();
  const assetsByPartner = new Map<string, PartnerEquipmentDbRow[]>();

  for (const partner of partners) {
    const exact = getExactCompanyNameKey(partner.company_name);
    if (exact) {
      const list = partnersByExactName.get(exact) ?? [];
      list.push(partner);
      partnersByExactName.set(exact, list);
    }

    const normalized = normalizeCompanyName(partner.company_name);
    if (normalized) {
      const list = partnersByNormalizedName.get(normalized) ?? [];
      list.push(partner);
      partnersByNormalizedName.set(normalized, list);
    }
  }

  for (const asset of assets) {
    const list = assetsByPartner.get(asset.partner_id) ?? [];
    list.push(asset);
    assetsByPartner.set(asset.partner_id, list);
  }

  const items = rows.map((row) =>
    analyzeRow(row, partnersByExactName, partnersByNormalizedName, assetsByPartner)
  );

  const matchedPartnerIds = new Set(
    items.filter((item) => item.matched_partner_id).map((item) => item.matched_partner_id!)
  );
  const parsedPartnerNames = new Set(
    items.filter((item) => item.action !== "skip").map((item) => item.company_name)
  );
  const unmatchedPartnerNames = new Set(
    items
      .filter((item) => item.action === "review" && !item.matched_partner_id)
      .map((item) => item.company_name)
  );

  const summary = items.reduce<PartnerEquipmentAnalysisSummary>(
    (acc, item) => {
      acc.total += 1;
      if (item.matched_partner_id) acc.matched_partners += 1;
      acc[item.action] += 1;
      return acc;
    },
    {
      total: 0,
      partner_count: parsedPartnerNames.size,
      matched_partners: matchedPartnerIds.size,
      unmatched_partners: unmatchedPartnerNames.size,
      create: 0,
      update: 0,
      skip: 0,
      review: 0
    }
  );

  return { items, summary };
}

function analyzeRow(
  row: ParsedPartnerEquipmentRow,
  partnersByExactName: Map<string, PartnerEquipmentPartnerRow[]>,
  partnersByNormalizedName: Map<string, PartnerEquipmentPartnerRow[]>,
  assetsByPartner: Map<string, PartnerEquipmentDbRow[]>
): PartnerEquipmentAnalysisItem {
  const base = {
    row_number: row.row_number,
    company_name: row.company_name,
    node_name: row.node_name,
    node_type: row.node_type,
    cpu: row.cpu,
    memory: row.memory,
    os_disk: row.os_disk,
    ceph_disk: row.ceph_disk,
    nic: row.nic,
    asset_status: row.asset_status,
    memo: row.memo,
    asset_type: row.asset_type,
    spec_summary: row.spec_summary,
    quantity: row.quantity,
    matched_partner_id: null as string | null,
    matched_partner_name: null as string | null,
    matched_asset_id: null as string | null
  };

  if (row.excluded) {
    return {
      ...base,
      action: "skip",
      reason: row.excluded_reason ?? "제외"
    };
  }

  const exactKey = getExactCompanyNameKey(row.company_name);
  const exactMatches = exactKey ? (partnersByExactName.get(exactKey) ?? []) : [];

  if (exactMatches.length === 1) {
    return resolveAssetAction(row, exactMatches[0]!, "정확한 회사명 일치", assetsByPartner);
  }

  if (exactMatches.length > 1) {
    return {
      ...base,
      action: "review",
      reason: "동일 회사명 파트너가 여러 건 존재"
    };
  }

  const normalized = row.normalized_company_name;
  const normalizedMatches = normalized
    ? (partnersByNormalizedName.get(normalized) ?? [])
    : [];

  if (normalizedMatches.length === 1) {
    return resolveAssetAction(
      row,
      normalizedMatches[0]!,
      "정규화 회사명 일치",
      assetsByPartner
    );
  }

  if (normalizedMatches.length > 1) {
    return {
      ...base,
      action: "review",
      reason: "정규화 후 동일 후보 파트너가 여러 건"
    };
  }

  return {
    ...base,
    action: "review",
    reason: "매칭되는 파트너 없음"
  };
}

function resolveAssetAction(
  row: ParsedPartnerEquipmentRow,
  partner: PartnerEquipmentPartnerRow,
  reasonPrefix: string,
  assetsByPartner: Map<string, PartnerEquipmentDbRow[]>
): PartnerEquipmentAnalysisItem {
  const partnerAssets = assetsByPartner.get(partner.id) ?? [];
  const existing = partnerAssets.find((asset) => isSameAsset(asset, row));

  if (existing) {
    return {
      row_number: row.row_number,
      company_name: row.company_name,
      node_name: row.node_name,
      node_type: row.node_type,
      cpu: row.cpu,
      memory: row.memory,
      os_disk: row.os_disk,
      ceph_disk: row.ceph_disk,
      nic: row.nic,
      asset_status: row.asset_status,
      memo: row.memo,
      asset_type: row.asset_type,
      spec_summary: row.spec_summary,
      quantity: row.quantity,
      action: "update",
      reason: `${reasonPrefix} · 기존 노드 업데이트`,
      matched_partner_id: partner.id,
      matched_partner_name: partner.company_name,
      matched_asset_id: existing.id
    };
  }

  return {
    row_number: row.row_number,
    company_name: row.company_name,
    node_name: row.node_name,
    node_type: row.node_type,
    cpu: row.cpu,
    memory: row.memory,
    os_disk: row.os_disk,
    ceph_disk: row.ceph_disk,
    nic: row.nic,
    asset_status: row.asset_status,
    memo: row.memo,
    asset_type: row.asset_type,
    spec_summary: row.spec_summary,
    quantity: row.quantity,
    action: "create",
    reason: `${reasonPrefix} · 신규 노드`,
    matched_partner_id: partner.id,
    matched_partner_name: partner.company_name,
    matched_asset_id: null
  };
}

function isSameAsset(asset: PartnerEquipmentDbRow, row: ParsedPartnerEquipmentRow): boolean {
  const rowNode = normalizeAssetNodeName(row.node_name);
  const assetNode = normalizeAssetNodeName(asset.node_name);
  if (rowNode && assetNode) return rowNode === assetNode;

  const assetType = (asset.asset_type ?? "").trim().toLowerCase();
  const rowType = (row.asset_type ?? "").trim().toLowerCase();
  const assetSpec = (asset.spec_summary ?? asset.asset_name ?? "").trim().toLowerCase();
  const rowSpec = (row.spec_summary ?? row.asset_name ?? "").trim().toLowerCase();

  if (assetType && rowType && assetType === rowType && assetSpec && rowSpec) {
    return assetSpec === rowSpec;
  }

  return assetSpec !== "" && rowSpec !== "" && assetSpec === rowSpec;
}
