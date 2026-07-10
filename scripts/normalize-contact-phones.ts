/**
 * 기존 contact_phones / partner_contacts 연락처 정규화 백필
 *
 * Usage:
 *   npx tsx scripts/normalize-contact-phones.ts          # dry-run
 *   CONFIRM_NORMALIZE=true npx tsx scripts/normalize-contact-phones.ts
 */

import { createClient } from "@supabase/supabase-js";
import {
  normalizePhoneInput,
  PHONE_REVIEW_REASON
} from "../src/lib/contacts/phone-normalize";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);
const confirm = process.env.CONFIRM_NORMALIZE === "true";

function appendReviewReason(existing: string | null | undefined, reason: string): string {
  const trimmed = existing?.trim();
  if (!trimmed) return reason;
  if (trimmed.includes(reason)) return trimmed;
  return `${trimmed}; ${reason}`;
}

async function main() {
  const { data: phoneRows, error: phoneError } = await supabase
    .from("contact_phones")
    .select("id, contact_id, phone, raw_phone, normalized_phone, display_phone, needs_review");

  if (phoneError) throw new Error(phoneError.message);

  let phoneUpdates = 0;
  for (const row of phoneRows ?? []) {
    const source = row.raw_phone ?? row.phone;
    const result = normalizePhoneInput(source);
    if (!result) continue;

    const changed =
      row.raw_phone !== result.raw_phone ||
      row.normalized_phone !== result.normalized_phone ||
      row.display_phone !== result.display_phone ||
      row.needs_review !== result.needs_review ||
      row.phone !== result.display_phone;

    if (!changed) continue;
    phoneUpdates += 1;

    if (confirm) {
      const { error } = await supabase
        .from("contact_phones")
        .update({
          phone: result.display_phone,
          raw_phone: result.raw_phone,
          normalized_phone: result.normalized_phone,
          display_phone: result.display_phone,
          needs_review: result.needs_review
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    }
  }

  const { data: contacts, error: contactError } = await supabase
    .from("partner_contacts")
    .select("id, phone, phone_raw, phone_normalized, phone_display, review_required, review_reason")
    .is("deleted_at", null);

  if (contactError) throw new Error(contactError.message);

  let contactUpdates = 0;
  for (const row of contacts ?? []) {
    const source = row.phone_raw ?? row.phone;
    if (!source?.trim()) continue;

    const result = normalizePhoneInput(source);
    if (!result) continue;

    const changed =
      row.phone_raw !== result.raw_phone ||
      row.phone_normalized !== result.normalized_phone ||
      row.phone_display !== result.display_phone ||
      row.phone !== result.display_phone;

    if (!changed && !(result.needs_review && !row.review_required)) continue;
    contactUpdates += 1;

    if (confirm) {
      const payload: Record<string, unknown> = {
        phone: result.display_phone,
        phone_raw: result.raw_phone,
        phone_normalized: result.normalized_phone,
        phone_display: result.display_phone
      };

      if (result.needs_review) {
        payload.review_required = true;
        payload.review_reason = appendReviewReason(
          row.review_reason as string | null,
          PHONE_REVIEW_REASON
        );
      }

      const { error } = await supabase.from("partner_contacts").update(payload).eq("id", row.id);
      if (error) throw new Error(error.message);
    }
  }

  console.log(
    confirm ? "정규화 완료" : "dry-run",
    `- contact_phones ${phoneUpdates}건, partner_contacts ${contactUpdates}건`
  );
  if (!confirm) {
    console.log("적용하려면 CONFIRM_NORMALIZE=true 로 다시 실행하세요.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
