import { PARTNER_POLICY_BUCKET } from "@/lib/policy/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export function isSafePolicyStorageKey(key: string): boolean {
  return /^[a-zA-Z0-9/_\-.]+$/.test(key);
}

export function buildPolicyStoragePath(
  effectiveDate: string,
  documentId: string,
  originalFileName: string
): string {
  const year = effectiveDate.slice(0, 4);
  const safeName = originalFileName
    .replace(/[^\w.\-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return `${year}/${effectiveDate}/${documentId}_${safeName}`;
}

export async function ensurePartnerPolicyBucket(supabase: SupabaseClient): Promise<void> {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Storage bucket 확인 실패: ${listError.message}`);
  }

  const exists = (buckets ?? []).some((bucket) => bucket.name === PARTNER_POLICY_BUCKET);
  if (exists) return;

  const { error: createError } = await supabase.storage.createBucket(PARTNER_POLICY_BUCKET, {
    public: false
  });

  if (createError) {
    throw new Error(
      `Supabase Storage에 ${PARTNER_POLICY_BUCKET} bucket이 없습니다. bucket을 먼저 생성해 주세요.`
    );
  }
}
