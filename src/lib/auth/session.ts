import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** layout / page에서 getUser 중복 호출 방지 */
export const getCachedAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
});

export const getCachedAuthEmail = cache(async (): Promise<string | null> => {
  const user = await getCachedAuthUser();
  return user?.email ?? null;
});
