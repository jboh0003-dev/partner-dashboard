"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function addPartnerNote(formData: FormData) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    throw new Error("관리자 권한이 필요합니다.");
  }

  const supabase = await createClient();

  const partnerId = String(formData.get("partner_id") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;

  if (!partnerId || !content) {
    throw new Error("메모 내용은 필수입니다.");
  }

  const { error } = await supabase.from("partner_notes").insert({
    partner_id: partnerId,
    title,
    content,
    note_type: "general"
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/partners/${partnerId}`);
}
