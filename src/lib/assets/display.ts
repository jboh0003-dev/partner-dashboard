import type { PartnerAsset } from "@/types/asset";

export function formatAssetSpec(
  row: Pick<PartnerAsset, "spec_summary" | "asset_name" | "vendor" | "model_name">
): string {
  return (
    row.spec_summary?.trim() ||
    row.asset_name?.trim() ||
    [row.vendor, row.model_name].filter(Boolean).join(" / ") ||
    "-"
  );
}

export function formatAssetUpdatedAt(
  row: Pick<PartnerAsset, "last_synced_at" | "updated_at" | "created_at">
): string {
  const value = row.last_synced_at ?? row.updated_at ?? row.created_at;
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}
