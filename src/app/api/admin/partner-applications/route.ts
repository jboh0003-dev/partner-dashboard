import { NextResponse } from "next/server";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return unauthorizedJson(auth.message);

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim() || "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const supabase = createAdminClient();
  let query = supabase
    .from("partner_applications")
    .select(
      "id, application_number, status, company_name, business_registration_number, applicant_name, applicant_email, contact_name, contact_email, submitted_at, created_at, missing_required_count, technical_collaboration_requested, platinum_review_requested, approved_partner_id"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (from) query = query.gte("submitted_at", from);
  if (to) query = query.lte("submitted_at", to);
  if (q) {
    query = query.or(
      `company_name.ilike.%${q}%,business_registration_number.ilike.%${q}%,application_number.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: data ?? [] });
}
