import { NextResponse } from "next/server";
import { requireUser, unauthorizedJson } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PARTNER_APPLICATIONS_BUCKET
} from "@/lib/partner-applications/repository";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return unauthorizedJson(auth.message);

  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!app) return NextResponse.json({ ok: false, message: "없음" }, { status: 404 });

  const [{ data: people }, { data: customers }, { data: equipment }, { data: engineers }, { data: documents }, { data: events }] =
    await Promise.all([
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
        .select("*")
        .eq("application_id", id)
        .order("created_at", { ascending: false })
        .limit(50)
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

  return NextResponse.json({
    ok: true,
    application: app,
    people: people ?? [],
    customers: customers ?? [],
    equipment: equipment ?? [],
    engineers: engineers ?? [],
    documents: docsWithUrls,
    events: events ?? []
  });
}
