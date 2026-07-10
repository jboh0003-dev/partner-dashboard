import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminAuthResult =
  | { ok: true; userId: string | null; role: string }
  | { ok: false; status: number; message: string };

export type ViewerAuthContext = {
  user: { id: string; email: string | null } | null;
  profile: { id: string; role: string | null } | null;
  role: string | null;
  isAdmin: boolean;
  /** development 환경에서 profile admin 없이 bypass된 경우 */
  devBypass: boolean;
};

// TODO(auth): Supabase Auth 세션 + profiles.role 기반 권한 체계를 정리하고,
// development bypass를 제거한 뒤 admin 역할 부여/로그인 흐름을 통합할 것.

/** development에서만 true — production에서는 profiles.role === 'admin'만 허용 */
export function isDevelopmentAdminBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * UI/API 공통 admin 판정.
 * - production: profiles.role === 'admin'
 * - development: profiles row 없어도 true (로컬 CRUD 검증용)
 */
export function resolveViewerIsAdmin(role: string | null | undefined): boolean {
  if (role === "admin") return true;
  return isDevelopmentAdminBypassEnabled();
}

async function resolveDevFallbackUserId(): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    return data?.id ? String(data.id) : null;
  } catch {
    return null;
  }
}

export async function getViewerAuthContext(): Promise<ViewerAuthContext> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: { id: string; role: string | null } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      profile = { id: String(data.id), role: data.role ? String(data.role) : null };
    }
  }

  const role = profile?.role ?? null;
  const profileIsAdmin = role === "admin";
  const devBypass = isDevelopmentAdminBypassEnabled() && !profileIsAdmin;
  const isAdmin = resolveViewerIsAdmin(role);

  const context: ViewerAuthContext = {
    user: user ? { id: user.id, email: user.email ?? null } : null,
    profile,
    role,
    isAdmin,
    devBypass
  };

  if (isDevelopmentAdminBypassEnabled()) {
    console.log("[contacts/auth] isAdmin =", context.isAdmin);
    console.log("[contacts/auth] detail", {
      user: context.user,
      profile: context.profile,
      role: context.role,
      devBypass: context.devBypass,
      profilesEmpty: context.profile === null,
      nodeEnv: process.env.NODE_ENV
    });
  }

  return context;
}

export async function getViewerRole(): Promise<string | null> {
  const context = await getViewerAuthContext();
  if (context.isAdmin) return "admin";
  return context.role;
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

    const role = String(profile?.role ?? "");
    if (role === "admin") {
      return { ok: true, userId: user.id, role };
    }
  }

  // TODO(auth): development bypass — 운영 배포 전 제거 또는 env 플래그로 분리할 것.
  if (isDevelopmentAdminBypassEnabled()) {
    const fallbackUserId = user?.id ?? (await resolveDevFallbackUserId());
    console.log("[auth] requireAdmin: development bypass", {
      hasSessionUser: Boolean(user),
      authError: authError?.message ?? null,
      fallbackUserId
    });
    return { ok: true, userId: fallbackUserId, role: "admin" };
  }

  if (authError || !user) {
    return { ok: false, status: 401, message: "로그인이 필요합니다." };
  }

  return { ok: false, status: 403, message: "관리자 권한이 필요합니다." };
}
