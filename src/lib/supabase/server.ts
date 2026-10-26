import { recoveryEnabled } from "@/lib/recovery/database";
import { nativeFetch } from "@/lib/recovery/rest";
import { verifyRecovery, RECOVERY_COOKIE } from "@/lib/recovery/session";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  }

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...(recoveryEnabled() ? { global: { fetch: nativeFetch } } : {}),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component에서는 set이 실패할 수 있음. Middleware에서 처리.
        }
      }
    }
  });
  if (recoveryEnabled()) {
    const user = await verifyRecovery(cookieStore.get(RECOVERY_COOKIE)?.value);
    client.auth.getUser = (async () => ({ data: { user: user ? { id: user.id, email: user.email, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' } : null }, error: null })) as typeof client.auth.getUser;
    client.auth.getClaims = (async () => ({ data: user ? { claims: { sub: user.id, email: user.email, role: 'authenticated' }, header: {}, signature: new Uint8Array() } : null, error: null })) as typeof client.auth.getClaims;
  }
  return client;
}
