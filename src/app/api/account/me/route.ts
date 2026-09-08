import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { resolveIsAdmin, displayRoleLabel } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("name, email, role")
    .eq("id", auth.userId)
    .maybeSingle();

  const role = profile?.role ? String(profile.role) : null;
  const isAdmin = resolveIsAdmin(role);
  return NextResponse.json({
    ok: true,
    user: {
      email: profile?.email ? String(profile.email) : auth.email,
      name: profile?.name ? String(profile.name) : null,
      roleLabel: displayRoleLabel(isAdmin ? "admin" : role),
      isAdmin
    }
  }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" } });
}
