import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { resolveIsAdmin, displayRoleLabel } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTH_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  Vary: "Cookie"
};

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, message: auth.message },
      { status: auth.status, headers: AUTH_RESPONSE_HEADERS }
    );
  }

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("name, email, role")
    .eq("id", auth.userId)
    .maybeSingle();

  const role = profile?.role ? String(profile.role) : null;
  const isAdmin = resolveIsAdmin(role);

  return NextResponse.json(
    {
      ok: true,
      user: {
        id: auth.userId,
        email: profile?.email ? String(profile.email) : auth.email,
        name: profile?.name ? String(profile.name) : null,
        roleLabel: displayRoleLabel(isAdmin ? "admin" : role),
        isAdmin
      }
    },
    { headers: AUTH_RESPONSE_HEADERS }
  );
}
