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

export async function getViewerAuthContext(): Promise<ViewerAuthContext> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: ViewerAuthContext["profile"] = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, role, name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      profile = {
        id: String(data.id),
        role: data.role ? String(data.role) : null,
        name: data.name ? String(data.name) : null,
        email: data.email ? String(data.email) : user.email ?? null
      };
    }
  }

  const role = profile?.role ?? null;
  const isAdmin = resolveIsAdmin(role);
  const devBypass = isDevAdminBypassEnabled() && !isAdminRoleSafe(role) && isAdmin;

  return {
    user: user ? { id: user.id, email: user.email ?? null } : null,
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
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return { ok: false, status: 500, message: profileError.message };
    }

    const role = profile?.role ? String(profile.role) : null;
    if (resolveIsAdmin(role)) {
      return { ok: true, userId: user.id, role: role ?? "admin" };
    }
  }

  if (authError || !user) {
    return {
      ok: false,
      status: 401,
      message: "로그인이 필요합니다. 다시 로그인해주세요."
    };
  }

  return { ok: false, status: 403, message: "관리자 권한이 필요합니다." };
}
