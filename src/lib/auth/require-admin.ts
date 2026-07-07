import { createClient } from "@/lib/supabase/server";

export type AdminAuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; status: number; message: string };

export async function requireAdmin(): Promise<AdminAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, message: "로그인이 필요합니다." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, status: 500, message: profileError.message };
  }

  const role = String(profile?.role ?? "");
  if (role !== "admin") {
    return { ok: false, status: 403, message: "관리자 권한이 필요합니다." };
  }

  return { ok: true, userId: user.id, role };
}

export async function getViewerRole(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.role ? String(profile.role) : null;
}
