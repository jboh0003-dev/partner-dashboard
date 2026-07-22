import { createClient } from "@/lib/supabase/server";

export type AuthUserResult =
  | { ok: true; userId: string; email: string | null }
  | { ok: false; status: number; message: string };

/**
 * 로그인 사용자 필수 (역할 무관).
 * API route에서 세션 검증용. service role 우회와 별개로 호출자 인증을 확인한다.
 */
export async function requireUser(): Promise<AuthUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      status: 401,
      message: "로그인이 필요합니다. 다시 로그인해주세요."
    };
  }

  return {
    ok: true,
    userId: user.id,
    email: user.email ?? null
  };
}

export function unauthorizedJson(message = "로그인이 필요합니다.") {
  return Response.json({ ok: false, message }, { status: 401 });
}
