import { ASSET_NODE_ORDER, COMPUTE_NODE_DISPLAY_NAME } from "@/types/asset";
import type { PartnerAsset } from "@/types/asset";

/** 컴퓨터/컴퓨트/컴퓨팅/Compute Node + 1식(괄호·공백 변형 포함) */
export const COMPUTE_NODE_MATCH_PATTERN =
  /(?:컴퓨(?:터|트|팅)\s*노드|compute\s*node|computing\s*node)\s*(?:[\(（]?\s*1\s*식\s*[\)）]?|\b1\b(?!\d))/i;

const COMPUTE_NODE_HINT_PATTERN = /(?:컴퓨(?:터|트|팅)|compute)/i;

export function normalizeNodeLabelForMatch(label: string): string {
  return label
    .replace(/▶/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\(（]\s*(\d+)\s*식\s*[\)）]/g, " $1식")
    .replace(/규격\s*$/i, "")
    .trim();
}

const CONTROL_NODE_PATTERNS: Array<{ node_name: string; pattern: RegExp }> = [
  { node_name: "컨트롤 노드 1식", pattern: /컨트롤\s*노드\s*1\s*식/i },
  { node_name: "컨트롤 노드 2식", pattern: /컨트롤\s*노드\s*2\s*식/i },
  { node_name: "컨트롤 노드 3식", pattern: /컨트롤\s*노드\s*3\s*식/i }
];

export { COMPUTE_NODE_DISPLAY_NAME };

function matchesComputeNodeText(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const text = normalizeNodeLabelForMatch(value);
  if (COMPUTE_NODE_MATCH_PATTERN.test(text)) return true;
  return COMPUTE_NODE_HINT_PATTERN.test(text) && /노드/i.test(text);
}

export function normalizeAssetNodeName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  const text = normalizeNodeLabelForMatch(name);

  for (const item of CONTROL_NODE_PATTERNS) {
    if (item.pattern.test(text)) return item.node_name;
  }

  if (matchesComputeNodeText(text)) {
    return COMPUTE_NODE_DISPLAY_NAME;
  }

  return text;
}

export function normalizeAssetNodeType(
  nodeName: string | null | undefined,
  nodeType: string | null | undefined
): string | null {
  const normalizedName = normalizeAssetNodeName(nodeName);
  if (normalizedName === COMPUTE_NODE_DISPLAY_NAME) return "컴퓨트 노드";
  if (normalizedName?.startsWith("컨트롤 노드")) return "컨트롤 노드";
  if (matchesComputeNodeText(nodeType)) return "컴퓨트 노드";
  return nodeType ?? null;
}

export function isControlNodeAsset(asset: Pick<PartnerAsset, "node_name" | "node_type">): boolean {
  const name = normalizeAssetNodeName(asset.node_name);
  if (name?.startsWith("컨트롤 노드")) return true;
  return asset.node_type === "컨트롤 노드";
}

export function isComputeNodeAsset(
  asset: Pick<PartnerAsset, "node_name" | "node_type"> & { asset_name?: string | null }
): boolean {
  const name = normalizeAssetNodeName(asset.node_name);
  if (name === COMPUTE_NODE_DISPLAY_NAME) return true;
  if (matchesComputeNodeText(asset.node_name)) return true;
  if (matchesComputeNodeText(asset.node_type)) return true;
  if (matchesComputeNodeText(asset.asset_name)) return true;
  return asset.node_type === "컴퓨트 노드" || asset.node_type === "컴퓨터 노드";
}

export function sortAssetsByNodeOrder<
  T extends Pick<PartnerAsset, "node_name" | "node_type"> & { asset_name?: string | null }
>(assets: T[]): T[] {
  return [...assets].sort(
    (left, right) => getAssetNodeSortRank(left) - getAssetNodeSortRank(right)
  );
}

function getAssetNodeSortRank(
  asset: Pick<PartnerAsset, "node_name" | "node_type"> & { asset_name?: string | null }
): number {
  if (isComputeNodeAsset(asset)) {
    return ASSET_NODE_ORDER.indexOf(COMPUTE_NODE_DISPLAY_NAME);
  }

  const leftName = normalizeAssetNodeName(asset.node_name) ?? asset.node_name ?? "";
  const rank = ASSET_NODE_ORDER.indexOf(leftName as (typeof ASSET_NODE_ORDER)[number]);
  return rank === -1 ? ASSET_NODE_ORDER.length : rank;
}

export function formatControlNodeCountLabel(
  assets: Pick<PartnerAsset, "node_name" | "node_type">[]
): string {
  const count = assets.filter(isControlNodeAsset).length;
  if (count <= 0) return "-";
  return `컨트롤 ${count}식`;
}

export function formatComputeNodeCountLabel(
  assets: Pick<PartnerAsset, "node_name" | "node_type">[]
): string {
  return assets.some(isComputeNodeAsset) ? "컴퓨터 1식" : "-";
}

export function pickRepresentativeAsset<T extends PartnerAsset>(assets: T[]): T | null {
  const sorted = sortAssetsByNodeOrder(assets);
  const controlOne = sorted.find(
    (asset) => normalizeAssetNodeName(asset.node_name) === "컨트롤 노드 1식"
  );
  if (controlOne) return controlOne;
  return sorted[0] ?? null;
}

export function pickLatestUpdatedAt(assets: PartnerAsset[]): string | null {
  const timestamps = assets
    .map((asset) => asset.last_synced_at ?? asset.updated_at ?? asset.created_at)
    .filter(Boolean)
    .map((value) => new Date(value!).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export function pickPartnerAssetStatus(assets: PartnerAsset[]): string | null {
  const statuses = assets
    .map((asset) => asset.asset_status?.trim())
    .filter((value): value is string => !!value);

  if (statuses.includes("보유")) return "보유";
  if (statuses.includes("확보 예정")) return "확보 예정";
  if (statuses.includes("확인필요")) return "확인필요";
  return statuses[0] ?? null;
}
