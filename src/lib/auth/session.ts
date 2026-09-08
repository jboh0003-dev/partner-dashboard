import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * 인증이 필요한 실제 권한 확인용.
 * middleware에서 이미 보호 경로를 검증하지만, 서버 로직에서 사용자 객체가 꼭 필요할 때 사용한다.
 */
export const getCachedAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
});

/**
 * 사이드바에 이메일만 표시할 때는 현재 세션 쿠키를 읽는다.
 * 보호 경로 인증은 middleware의 getUser()가 담당하므로 여기서 원격 getUser()를 한 번 더 호출하지 않는다.
 */
export const getCachedAuthEmail = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session?.user?.email ?? null;
});
