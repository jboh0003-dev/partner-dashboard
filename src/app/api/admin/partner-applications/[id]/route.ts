import { NextResponse } from "next/server";
import { forbiddenJson, requireAdmin } from "@/lib/auth/require-admin";
import { unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PARTNER_APPLICATIONS_BUCKET,
  deletePartnerApplication
} from "@/lib/partner-applications/repository";
import { latestPreReviewFromEvents } from "@/lib/partner-applications/pre-review";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.status === 401 ? unauthorizedJson(auth.message) : forbiddenJson(auth.message);
  }

  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!app) return NextResponse.json({ ok: false, message: "없음" }, { status: 404 });

  const [
    { data: people },
    { data: customers },
    { data: equipment },
    { data: engineers },
    { data: documents },
    { data: events },
    { count: draftSavedCount },
    { data: draftEvents }
  ] = await Promise.all([
    supabase
      .from("partner_application_people")
      .select("*")
      .eq("application_id", id)
      .order("sort_order"),
    supabase
      .from("partner_application_customers")
      .select("*")
      .eq("application_id", id)
      .order("sort_order"),
    supabase
      .from("partner_application_equipment")
      .select("*")
      .eq("application_id", id)
      .order("sort_order"),
    supabase
      .from("partner_application_engineers")
      .select("*")
      .eq("application_id", id)
      .order("sort_order"),
    supabase
      .from("partner_application_documents")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_application_events")
      .select("id, created_at, event_type, message, payload")
      .eq("application_id", id)
      .neq("event_type", "draft_saved")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("partner_application_events")
      .select("*", { count: "exact", head: true })
      .eq("application_id", id)
      .eq("event_type", "draft_saved"),
    supabase
      .from("partner_application_events")
      .select("id, created_at, event_type")
      .eq("application_id", id)
      .eq("event_type", "draft_saved")
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  const docsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      if (!doc.is_active) return { ...doc, signed_url: null };
      const { data: signed } = await supabase.storage
        .from(PARTNER_APPLICATIONS_BUCKET)
        .createSignedUrl(String(doc.storage_path), 60 * 30);
      return { ...doc, signed_url: signed?.signedUrl ?? null };
    })
  );

  const application = app as Record<string, unknown>;
  delete application.access_token_hash;
  delete application.lookup_password_hash;

  return NextResponse.json({
    ok: true,
    application,
    people: people ?? [],
    customers: customers ?? [],
    equipment: equipment ?? [],
    engineers: engineers ?? [],
    documents: docsWithUrls.map(({ storage_path: _storagePath, ...doc }) => doc),
    events: (events ?? []).map(({ payload: _payload, ...ev }) => ev),
    draft_saved_count: draftSavedCount ?? 0,
    draft_events: draftEvents ?? [],
    pre_review: latestPreReviewFromEvents(events ?? [])
  });
}

export async function DELETE(_request: Request, context: Ctx) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return auth.status === 401 ? unauthorizedJson(auth.message) : forbiddenJson(auth.message);
  }

  const { id } = await context.params;
  const supabase = createAdminClient();
  const result = await deletePartnerApplication(supabase, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
