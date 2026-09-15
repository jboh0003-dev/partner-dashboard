import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isDevAdminBypassEnabled, resolveIsAdmin } from "@/lib/auth/roles";

export type AdminAuthResult =
  | { ok: true; userId: string | null; role: string }
  | { ok: false; status: number; message: string };

export type ViewerAuthContext = {
  user: { id: string; email: string | null } | null;
  profile: { id: string; role: string | null; name: string | null; email: string | null } | null;
  role: string | null;
  isAdmin: boolean;
  devBypass: boolean;
};

export { isDevAdminBypassEnabled };

export function resolveViewerIsAdmin(role: string | null | undefined): boolean {
  return resolveIsAdmin(role);
}

function claimString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function getViewerAuthContext(): Promise<ViewerAuthContext> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claimString(claims?.sub);
  const userEmail = claimString(claims?.email);

  let profile: ViewerAuthContext["profile"] = null;

  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("id, role, name, email")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      profile = {
        id: String(data.id),
        role: data.role ? String(data.role) : null,
        name: data.name ? String(data.name) : null,
        email: data.email ? String(data.email) : userEmail
      };
    }
  }

  const role = profile?.role ?? null;
  const isAdmin = resolveIsAdmin(role);
  const devBypass = isDevAdminBypassEnabled() && !isAdminRoleSafe(role) && isAdmin;

  return {
    user: userId ? { id: userId, email: userEmail } : null,
    profile,
    role,
    isAdmin,
    devBypass
  };
}

function isAdminRoleSafe(role: string | null): boolean {
  return role === "admin";
}

export const getCachedViewerAuthContext = cache(getViewerAuthContext);

export async function getViewerRole(): Promise<string | null> {
  const context = await getCachedViewerAuthContext();
  if (context.isAdmin) return "admin";
  return context.role;
}

export function forbiddenJson(message = "관리자 권한이 필요합니다.") {
  return Response.json({ ok: false, message }, { status: 403 });
}

export async function rejectUnlessAdmin(): Promise<Response | null> {
  const auth = await requireAdmin();
  if (auth.ok) return null;
  if (auth.status === 401) {
    return Response.json({ ok: false, message: auth.message }, { status: 401 });
  }
  return forbiddenJson(auth.message);
}

export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = await createClient();
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = claimString(claims?.sub);

  if (userId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return { ok: false, status: 500, message: profileError.message };
    }

    const role = profile?.role ? String(profile.role) : null;
    if (resolveIsAdmin(role)) {
      return { ok: true, userId, role: role ?? "admin" };
    }
  }

  if (authError || !userId) {
    return {
      ok: false,
      status: 401,
      message: "로그인이 필요합니다. 다시 로그인해주세요."
    };
  }

  return { ok: false, status: 403, message: "관리자 권한이 필요합니다." };
}
