import {
  COMPUTE_NODE_DISPLAY_NAME,
  isComputeNodeAsset,
  normalizeAssetNodeName,
  sortAssetsByNodeOrder
} from "@/lib/assets/node-utils";
import type { PartnerAsset } from "@/types/asset";

export function preparePartnerDetailAssets(assets: PartnerAsset[]): PartnerAsset[] {
  const enriched = assets.map((asset) => {
    if (!isComputeNodeAsset(asset)) return asset;

    const normalized = normalizeAssetNodeName(asset.node_name);
    if (normalized === COMPUTE_NODE_DISPLAY_NAME) return asset;

    return {
      ...asset,
      node_name: asset.node_name?.trim() || COMPUTE_NODE_DISPLAY_NAME
    };
  });

  return sortAssetsByNodeOrder(enriched);
}

export function formatAssetNodeDisplayName(
  asset: Pick<PartnerAsset, "node_name" | "node_type" | "asset_name">
): string {
  if (isComputeNodeAsset(asset)) {
    return COMPUTE_NODE_DISPLAY_NAME;
  }

  return normalizeAssetNodeName(asset.node_name) ?? asset.node_name ?? asset.asset_name ?? "장비 노드";
}
