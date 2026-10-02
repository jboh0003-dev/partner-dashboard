import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OWNER_ID = "6b290f26-391a-432f-bec9-a72c3cc8335c";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Work Hub cloud environment is not configured.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function GET() {
  try {
    const db = adminClient();
    const { data, error } = await db
      .from("workhub_state")
      .select("state,updated_at")
      .eq("user_id", OWNER_ID)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ ok: true, data }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Cloud read failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ ok: false, message: "Invalid origin." }, { status: 403 });
    }

    const body = await request.json();
    if (!body || typeof body.state !== "object" || body.state === null) {
      return NextResponse.json({ ok: false, message: "Invalid state." }, { status: 400 });
    }

    const db = adminClient();
    const updatedAt = new Date().toISOString();
    const { error } = await db.from("workhub_state").upsert({
      user_id: OWNER_ID,
      state: body.state,
      updated_at: updatedAt
    }, { onConflict: "user_id" });

    if (error) throw error;
    return NextResponse.json({ ok: true, updated_at: updatedAt });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Cloud write failed." },
      { status: 500 }
    );
  }
}
