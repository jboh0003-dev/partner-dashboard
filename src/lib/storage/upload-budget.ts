import type { SupabaseClient } from "@supabase/supabase-js";

// Free-plan Storage 1GB quota: leave at least 100MB of operating headroom.
// This is an application-level soft cap, not a replacement for Supabase quotas.
export const PARTNER_STORAGE_SAFE_LIMIT_BYTES = 900_000_000;

export type UploadBudget = {
  usedBytes: number;
  availableBytes: number;
  limitBytes: number;
};

export async function readPartnerStorageBudget(
  supabase: SupabaseClient
): Promise<UploadBudget> {
  const { data, error } = await supabase.rpc("partner_storage_usage_bytes");
  if (error) {
    throw new Error("Storage 사용량을 확인할 수 없어 업로드를 중단했습니다.");
  }
  const usedBytes = Number(data);
  if (!Number.isFinite(usedBytes) || usedBytes < 0) {
    throw new Error("Storage 사용량 정보가 올바르지 않아 업로드를 중단했습니다.");
  }
  return {
    usedBytes,
    availableBytes: Math.max(0, PARTNER_STORAGE_SAFE_LIMIT_BYTES - usedBytes),
    limitBytes: PARTNER_STORAGE_SAFE_LIMIT_BYTES
  };
}

export async function requirePartnerStorageBudget(
  supabase: SupabaseClient,
  additionalBytes: number
): Promise<UploadBudget> {
  const budget = await readPartnerStorageBudget(supabase);
  if (!Number.isSafeInteger(additionalBytes) || additionalBytes < 0) {
    throw new Error("업로드 파일 크기가 올바르지 않습니다.");
  }
  if (additionalBytes > budget.availableBytes) {
    const mb = (value: number) => (value / 1_000_000).toFixed(1);
    throw new Error(
      `저장 공간 안전 한도(900MB)에 가까워 업로드를 중단했습니다. 현재 ${mb(budget.usedBytes)}MB / 여유 ${mb(budget.availableBytes)}MB / 요청 ${mb(additionalBytes)}MB입니다. 기존 파일을 먼저 최적화하거나 더 작은 파일을 선택해 주세요.`
    );
  }
  return budget;
}
