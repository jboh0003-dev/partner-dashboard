import { verifyRecovery, RECOVERY_COOKIE } from "@/lib/recovery/session";
import { isWorkHubOwner, isWorkHubPath } from "@/lib/auth/work-hub-access";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildLoginRedirectUrl, getSafeRedirectPath } from "@/lib/auth/redirect";
import {
  isAdminOnlyApiPath,
  isAdminOnlyDashboardPath,
  isPublicApplicantPath,
  resolveIsAdmin
} from "@/lib/auth/roles";

function isPublicApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/public/");
}

function isProtectedPath(pathname: string): boolean {
  if (isWorkHubPath(pathname)) return true;
  if (isPublicApplicantPath(pathname) || isPublicApiPath(pathname)) return false;
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return true;
  if (pathname.startsWith("/api/") && !isPublicApiPath(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (process.env.CONNECT_NATIVE_RECOVERY === 'true' && !isWorkHubPath(pathname) && pathname !== '/continuity') {
    if (pathname === '/api/recovery/session') return NextResponse.next();
    const user = await verifyRecovery(request.cookies.get(RECOVERY_COOKIE)?.value);
    if (pathname === '/' || (pathname === '/login' && user)) return NextResponse.redirect(new URL(user ? '/dashboard' : '/login', request.url));
    if (isProtectedPath(pathname)) {
      if (!user) return pathname.startsWith('/api/') ? NextResponse.json({ok:false,message:'로그인이 필요합니다.'},{status:401}) : NextResponse.redirect(new URL(buildLoginRedirectUrl(pathname+search),request.url));
      if (pathname.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes(request.method)) return NextResponse.json({ok:false,message:'복구 모드에서는 조회만 가능합니다.'},{status:503});
      if (isAdminOnlyDashboardPath(pathname) && user.role !== 'admin') return NextResponse.redirect(new URL('/dashboard',request.url));
    }
    const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');response.headers.set('Vary','Cookie');return response;
  }


  // This isolated route verifies its own owner-only signed session before
  // returning any rows. All other Connect paths keep their normal protection.
  if (pathname === "/continuity") {
    const response = NextResponse.next({ request });
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response;
  }

  const detachedWorkHub =
    pathname === "/work-hub" ||
    pathname.startsWith("/work-hub/") ||
    pathname === "/api/work-hub" ||
    pathname.startsWith("/api/work-hub/") ||
    pathname.startsWith("/api/public/work-hub-");

  if (detachedWorkHub) {
    return new NextResponse(null, {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedPath(pathname)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ ok: false, message: "인증 환경변수가 설정되지 않았습니다." }, { status: 500 });
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => { request.cookies.set(name, value); });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => { supabaseResponse.cookies.set(name, value, options); });
      }
    }
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  if (pathname === "/login") {
    const forceWorkHubSwitch = request.nextUrl.searchParams.get("switch") === "workhub";
    if (userId && !forceWorkHubSwitch) {
      const redirectParam = request.nextUrl.searchParams.get("redirect");
      const target = getSafeRedirectPath(redirectParam, "/dashboard");
      const url = request.nextUrl.clone();
      url.pathname = target;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = userId ? "/dashboard" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!isProtectedPath(pathname)) return supabaseResponse;
  if (!userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, message: "로그인이 필요합니다. 다시 로그인해주세요." }, { status: 401 });
    }
    const nextPath = `${pathname}${search || ""}`;
    const loginPath = buildLoginRedirectUrl(nextPath);
    const url = request.nextUrl.clone();
    const [pathOnly, query = ""] = loginPath.split("?");
    url.pathname = pathOnly || "/login";
    url.search = query ? `?${query}` : "";
    return NextResponse.redirect(url);
  }

  if (isWorkHubPath(pathname)) {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || !isWorkHubOwner(user.id)) {
      if (pathname === "/work-hub") {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        url.searchParams.set("redirect", "/work-hub");
        url.searchParams.set("switch", "workhub");
        url.searchParams.set("reason", "workhub-owner");
        const redirectResponse = NextResponse.redirect(url);
        redirectResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
        redirectResponse.headers.set("Vary", "Cookie");
        return redirectResponse;
      }
      return NextResponse.json(
        { ok: false, message: "내 업무관리는 소유자 계정만 이용할 수 있습니다." },
        { status: user && !error ? 403 : 401, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } }
      );
    }
    supabaseResponse.headers.set("Cache-Control", "private, no-store, max-age=0");
    supabaseResponse.headers.set("Vary", "Cookie");
    supabaseResponse.headers.set("X-Robots-Tag", "noindex, nofollow");
    return supabaseResponse;
  }

  const denied = await enforceAdminAccess(request, supabase, userId, supabaseResponse);
  if (denied) return denied;
  return supabaseResponse;
}

async function enforceAdminAccess(
  request: NextRequest,
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  supabaseResponse: NextResponse
) {
  const { pathname } = request.nextUrl;
  const needsAdmin = isAdminOnlyDashboardPath(pathname) || isAdminOnlyApiPath(pathname, request.method);
  if (!needsAdmin) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const role = profile?.role ? String(profile.role) : null;
  if (resolveIsAdmin(role)) return null;
  if (pathname.startsWith("/api/")) return NextResponse.json({ ok: false, message: "관리자 권한이 필요합니다." }, { status: 403 });
  const url = request.nextUrl.clone();
  url.pathname = "/dashboard";
  url.search = "";
  const redirectResponse = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => { redirectResponse.cookies.set(cookie.name, cookie.value); });
  return redirectResponse;
}

export const config = {
  matcher: [
    "/work-hub/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"
  ]
};
